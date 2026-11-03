import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { readClientInfo } from './client-info';
import { TrackEventsDto } from './dto/track-events.dto';
import { MetricsService } from './metrics.service';

const MAX_PROPERTIES_BYTES = 2048;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly metrics: MetricsService,
  ) {}

  /** Eventos de producto (pantallas y acciones). Acepta anónimos para medir el funnel previo al login. */
  @Post('events')
  @HttpCode(202)
  @UseGuards(OptionalJwtAuthGuard)
  async track(@Body() dto: TrackEventsDto, @Req() req: Request & { user?: { sub?: string } }) {
    const client = readClientInfo(req.headers);
    const userId = req.user?.sub ?? null;
    const now = Date.now();

    const rows = dto.events.map((event) => {
      const at = event.at ? Date.parse(event.at) : NaN;
      const createdAt = at <= now && now - at <= MAX_EVENT_AGE_MS ? new Date(at) : new Date(now);
      const properties = JSON.stringify(event.properties ?? {});
      return {
        name: event.name,
        screen: event.screen ?? null,
        properties: properties.length <= MAX_PROPERTIES_BYTES ? properties : '{}',
        createdAt,
      };
    });

    await this.db.query(
      `INSERT INTO analytics_events
         (user_id, session_id, name, screen, properties, platform, app_version, created_at)
       SELECT u.id, $2, t.name, t.screen, t.properties, $6, $7, t.created_at
       FROM unnest($3::text[], $4::text[], $5::jsonb[], $8::timestamptz[])
         AS t(name, screen, properties, created_at)
       LEFT JOIN users u ON u.id = $1::uuid`,
      [
        userId,
        dto.sessionId ?? null,
        rows.map((r) => r.name),
        rows.map((r) => r.screen),
        rows.map((r) => r.properties),
        client.platform,
        client.appVersion,
        rows.map((r) => r.createdAt),
      ],
    );
    this.metrics.analyticsEvents.inc({ platform: client.platform }, rows.length);
    return { accepted: rows.length };
  }
}
