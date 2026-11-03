import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Gauge } from 'prom-client';
import { DatabaseService } from '../database/database.service';
import type { ClientInfo } from './client-info';
import { MetricsService } from './metrics.service';

const ACTIVITY_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

interface PendingActivity {
  userId: string;
  day: string;
  platform: string;
  appVersion: string | null;
  requests: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

const ACTIVE_WINDOWS: Array<{ label: string; ms: number }> = [
  { label: '5m', ms: 5 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '24h', ms: DAY_MS },
];

/**
 * Acumula la actividad por usuario en memoria y la persiste cada minuto,
 * para no escribir en Neon en cada request.
 */
@Injectable()
export class ActivityService implements OnModuleDestroy {
  private readonly logger = new Logger(ActivityService.name);
  private readonly dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ACTIVITY_TIME_ZONE,
  });
  private pending = new Map<string, PendingActivity>();
  private readonly lastSeenByUser = new Map<string, number>();

  constructor(
    private readonly db: DatabaseService,
    metrics: MetricsService,
  ) {
    const lastSeenByUser = this.lastSeenByUser;
    new Gauge({
      name: 'x4_active_users',
      help: 'Usuarios distintos con requests autenticados en la ventana (desde el último reinicio)',
      labelNames: ['window'] as const,
      registers: [metrics.registry],
      collect() {
        const now = Date.now();
        for (const [userId, seenAt] of lastSeenByUser) {
          if (now - seenAt > DAY_MS) lastSeenByUser.delete(userId);
        }
        for (const { label, ms } of ACTIVE_WINDOWS) {
          let count = 0;
          for (const seenAt of lastSeenByUser.values()) {
            if (now - seenAt <= ms) count++;
          }
          this.set({ window: label }, count);
        }
      },
    });
  }

  record(userId: string, client: ClientInfo): void {
    if (!UUID_PATTERN.test(userId)) return;
    const now = new Date();
    this.lastSeenByUser.set(userId, now.getTime());

    const day = this.dayFormatter.format(now);
    const key = `${userId}|${day}|${client.platform}`;
    const entry = this.pending.get(key);
    if (entry) {
      entry.requests++;
      entry.lastSeenAt = now;
      entry.appVersion = client.appVersion ?? entry.appVersion;
      return;
    }
    this.pending.set(key, {
      userId,
      day,
      platform: client.platform,
      appVersion: client.appVersion,
      requests: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }

  @Interval(60_000)
  async flush(): Promise<void> {
    if (this.pending.size === 0) return;
    const rows = [...this.pending.values()];
    this.pending = new Map();

    const params = [
      rows.map((r) => r.userId),
      rows.map((r) => r.day),
      rows.map((r) => r.platform),
      rows.map((r) => r.appVersion),
      rows.map((r) => r.requests),
      rows.map((r) => r.firstSeenAt),
      rows.map((r) => r.lastSeenAt),
    ];
    const batch = `
      SELECT t.*
      FROM unnest($1::uuid[], $2::date[], $3::text[], $4::text[], $5::int[], $6::timestamptz[], $7::timestamptz[])
        AS t(user_id, day, platform, app_version, requests, first_seen_at, last_seen_at)
      JOIN users u ON u.id = t.user_id`;

    try {
      await this.db.query(
        `INSERT INTO user_activity_daily
           (user_id, day, platform, app_version, requests, first_seen_at, last_seen_at)
         ${batch}
         ON CONFLICT (user_id, day, platform) DO UPDATE SET
           requests = user_activity_daily.requests + EXCLUDED.requests,
           app_version = COALESCE(EXCLUDED.app_version, user_activity_daily.app_version),
           last_seen_at = GREATEST(user_activity_daily.last_seen_at, EXCLUDED.last_seen_at)`,
        params,
      );
      await this.db.query(
        `UPDATE users u SET
           last_seen_at = latest.last_seen_at,
           last_platform = latest.platform,
           last_app_version = COALESCE(latest.app_version, u.last_app_version)
         FROM (
           SELECT DISTINCT ON (b.user_id) b.user_id, b.platform, b.app_version, b.last_seen_at
           FROM (${batch}) b
           ORDER BY b.user_id, b.last_seen_at DESC
         ) latest
         WHERE u.id = latest.user_id
           AND (u.last_seen_at IS NULL OR u.last_seen_at < latest.last_seen_at)`,
        params,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`No se pudo guardar la actividad de ${rows.length} usuarios: ${msg}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.flush();
  }
}
