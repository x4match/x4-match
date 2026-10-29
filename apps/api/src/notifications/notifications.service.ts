import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  NOTIFICATION_CATEGORIES,
  NotificationPreferences,
  NotificationSettings,
  categoryForType,
  resolveNearbyMatchCategories,
  resolvePreferences,
  resolveSettings,
} from './notification-categories';

type PushPlatform = 'ios' | 'android';

type ExpoPushResult = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string; fault?: string };
};

/** Expo recomienda esperar ~15 min; 30 s alcanza para la mayoría de los recibos y sirve para diagnosticar. */
const PUSH_RECEIPT_DELAY_MS = 30_000;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
/** Límites de Expo: 100 mensajes por pedido de envío y 1000 ids por pedido de recibos. */
const EXPO_PUSH_BATCH_SIZE = 100;
const EXPO_RECEIPT_BATCH_SIZE = 1000;
const EXPO_MAX_RETRIES = 4;
const EXPO_RETRY_BASE_MS = 1_000;
const INSERT_BATCH_SIZE = 1000;
const DUE_PUSH_BATCH_SIZE = 1000;

export type NotificationPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Si es futura, el push se difiere hasta esa hora (la notificación igual aparece ya en la bandeja). */
  pushAfter?: Date;
};

type PushTarget = { payload: NotificationPayload; notificationId: string };

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  priority: 'high';
  data: Record<string, unknown>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clubIdOf(payload: NotificationPayload): string | null {
  const clubId = payload.data?.clubId;
  return typeof clubId === 'string' && clubId ? clubId : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(params: NotificationPayload) {
    const [created] = await this.createMany([params]);
    return created;
  }

  async createMany(items: NotificationPayload[]) {
    if (items.length === 0) return [];
    const created = items.map(() => ({ id: randomUUID() }));
    for (const [batchIndex, batch] of chunk(items, INSERT_BATCH_SIZE).entries()) {
      const ids = created
        .slice(batchIndex * INSERT_BATCH_SIZE, batchIndex * INSERT_BATCH_SIZE + batch.length)
        .map((row) => row.id);
      await this.db.query(
        `INSERT INTO notifications (id, user_id, type, title, body, data, push_after)
         SELECT id, user_id, type, title, body, data::jsonb, push_after
         FROM unnest($1::uuid[], $2::uuid[], $3::varchar[], $4::text[], $5::text[], $6::text[], $7::timestamptz[])
           AS t(id, user_id, type, title, body, data, push_after)`,
        [
          ids,
          batch.map((item) => item.userId),
          batch.map((item) => item.type),
          batch.map((item) => item.title),
          batch.map((item) => item.body),
          batch.map((item) => JSON.stringify(item.data ?? {})),
          batch.map((item) => (this.isDeferred(item) ? item.pushAfter!.toISOString() : null)),
        ],
      );
    }

    const targets = items
      .map((payload, index) => ({ payload, notificationId: created[index].id }))
      .filter((target) => !this.isDeferred(target.payload));
    if (targets.length > 0) {
      void this.sendPush(targets).catch((error: unknown) => {
        this.logger.warn(`Push no enviado: ${(error as Error).message}`);
      });
    }
    return created;
  }

  /** Manda los push diferidos cuya hora ya llegó. Lo dispara `NotificationsCron`. */
  async sendDuePushes(): Promise<number> {
    let total = 0;
    for (;;) {
      const due = await this.db.query<{
        id: string;
        user_id: string;
        type: string;
        title: string;
        body: string;
        data: Record<string, unknown> | null;
      }>(
        `UPDATE notifications SET push_after = NULL
         WHERE id IN (
           SELECT id FROM notifications
           WHERE push_after IS NOT NULL AND push_after <= NOW()
           ORDER BY push_after
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, user_id, type, title, body, data`,
        [DUE_PUSH_BATCH_SIZE],
      );
      if (due.rows.length === 0) break;
      total += due.rows.length;
      await this.sendPush(
        due.rows.map((row) => ({
          notificationId: row.id,
          payload: {
            userId: row.user_id,
            type: row.type,
            title: row.title,
            body: row.body,
            data: row.data ?? {},
          },
        })),
      );
      if (due.rows.length < DUE_PUSH_BATCH_SIZE) break;
    }
    return total;
  }

  private isDeferred(item: NotificationPayload): boolean {
    return item.pushAfter != null && item.pushAfter.getTime() > Date.now();
  }

  async listForUser(userId: string) {
    const result = await this.db.query(
      `SELECT id, type, title, body, data, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data,
      read: row.read,
      createdAt: row.created_at,
    }));
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.db.query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.db.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`, [
      userId,
    ]);
    return { ok: true };
  }

  async remove(userId: string, notificationId: string) {
    const result = await this.db.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return { ok: true, id: notificationId };
  }

  /** Borra las notificaciones de un tipo cuyo `data[key]` coincide (ej. avisos de un chat ya leído). */
  async removeByData(userId: string, type: string, key: string, value: string) {
    await this.db.query(
      `DELETE FROM notifications
       WHERE user_id = $1 AND type = $2 AND data ->> $3 = $4`,
      [userId, type, key, value],
    );
  }

  async removeAll(userId: string) {
    await this.db.query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
    return { ok: true };
  }

  async unreadCount(userId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    return { count: Number(result.rows[0]?.count ?? 0) };
  }

  async registerPushToken(userId: string, token: string, platform: PushPlatform) {
    await this.db.query(
      `INSERT INTO user_push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             updated_at = NOW()`,
      [userId, token.trim(), platform],
    );
    return { ok: true };
  }

  async unregisterPushToken(userId: string, token?: string) {
    if (token?.trim()) {
      await this.db.query(
        `DELETE FROM user_push_tokens WHERE user_id = $1 AND token = $2`,
        [userId, token.trim()],
      );
    } else {
      await this.db.query(`DELETE FROM user_push_tokens WHERE user_id = $1`, [userId]);
    }
    return { ok: true };
  }

  async getPreferences(userId: string): Promise<NotificationSettings> {
    const result = await this.db.query<{ preferences: unknown }>(
      `SELECT preferences FROM user_notification_preferences WHERE user_id = $1`,
      [userId],
    );
    return resolveSettings(result.rows[0]?.preferences);
  }

  async updatePreferences(
    userId: string,
    changes: Partial<NotificationPreferences> & { nearby_match_categories?: string[] },
  ): Promise<NotificationSettings> {
    const current = await this.getPreferences(userId);
    const next: NotificationSettings = { ...current };
    for (const category of NOTIFICATION_CATEGORIES) {
      if (typeof changes[category] === 'boolean') next[category] = changes[category] as boolean;
    }
    if (Array.isArray(changes.nearby_match_categories)) {
      next.nearby_match_categories = resolveNearbyMatchCategories({
        nearby_match_categories: changes.nearby_match_categories,
      });
    }
    await this.db.query(
      `INSERT INTO user_notification_preferences (user_id, preferences)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE
         SET preferences = EXCLUDED.preferences,
             updated_at = NOW()`,
      [userId, JSON.stringify(next)],
    );
    return next;
  }

  private async filterByPreferences(targets: PushTarget[]): Promise<PushTarget[]> {
    const categorized = targets.filter((target) => categoryForType(target.payload.type) !== null);
    if (categorized.length === 0) return targets;
    const userIds = [...new Set(categorized.map((target) => target.payload.userId))];
    const result = await this.db.query<{ user_id: string; preferences: unknown }>(
      `SELECT user_id, preferences FROM user_notification_preferences WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );
    const prefsByUser = new Map(
      result.rows.map((row) => [row.user_id, resolvePreferences(row.preferences)]),
    );

    const clubOfferUserIds = [
      ...new Set(
        categorized
          .filter((target) => categoryForType(target.payload.type) === 'club_offers' && clubIdOf(target.payload))
          .map((target) => target.payload.userId),
      ),
    ];
    const mutedPairs = new Set<string>();
    if (clubOfferUserIds.length > 0) {
      const muted = await this.db.query<{ user_id: string; club_id: string }>(
        `SELECT user_id, club_id FROM user_muted_clubs WHERE user_id = ANY($1::uuid[])`,
        [clubOfferUserIds],
      );
      for (const row of muted.rows) mutedPairs.add(`${row.user_id}:${row.club_id}`);
    }

    return targets.filter((target) => {
      const category = categoryForType(target.payload.type);
      if (!category) return true;
      if (category === 'club_offers' && mutedPairs.has(`${target.payload.userId}:${clubIdOf(target.payload)}`)) {
        return false;
      }
      return prefsByUser.get(target.payload.userId)?.[category] ?? true;
    });
  }

  /** De `userIds`, los que aceptan ofertas de este club (no desactivaron la categoría ni lo silenciaron). */
  async filterClubOfferRecipients(clubId: string, userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const blocked = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM user_muted_clubs WHERE club_id = $1 AND user_id = ANY($2::uuid[])
       UNION
       SELECT user_id FROM user_notification_preferences
       WHERE user_id = ANY($2::uuid[]) AND preferences ->> 'club_offers' = 'false'`,
      [clubId, userIds],
    );
    const excluded = new Set(blocked.rows.map((row) => row.user_id));
    return userIds.filter((userId) => !excluded.has(userId));
  }

  async listMutedClubs(userId: string) {
    const result = await this.db.query<{
      club_id: string;
      name: string;
      city: string | null;
      logo_url: string | null;
      created_at: string;
    }>(
      `SELECT c.id AS club_id, c.name, c.city, c.logo_url, m.created_at
       FROM user_muted_clubs m
       INNER JOIN clubs c ON c.id = m.club_id
       WHERE m.user_id = $1
       ORDER BY c.name`,
      [userId],
    );
    return result.rows.map((row) => ({
      clubId: row.club_id,
      name: row.name,
      city: row.city,
      logoUrl: row.logo_url,
      mutedAt: row.created_at,
    }));
  }

  async muteClub(userId: string, clubId: string) {
    const result = await this.db.query(
      `INSERT INTO user_muted_clubs (user_id, club_id)
       SELECT $1, id FROM clubs WHERE id = $2
       ON CONFLICT (user_id, club_id) DO NOTHING`,
      [userId, clubId],
    );
    if (result.rowCount === 0) {
      const exists = await this.db.query(`SELECT 1 FROM clubs WHERE id = $1`, [clubId]);
      if (!exists.rows[0]) throw new NotFoundException('Club no encontrado');
    }
    // Avisos pendientes de ese club: se quitan de la bandeja para que no lleguen tras silenciarlo.
    await this.db.query(
      `DELETE FROM notifications
       WHERE user_id = $1 AND push_after IS NOT NULL AND data ->> 'clubId' = $2`,
      [userId, clubId],
    );
    return { ok: true, clubId, muted: true };
  }

  async unmuteClub(userId: string, clubId: string) {
    await this.db.query(`DELETE FROM user_muted_clubs WHERE user_id = $1 AND club_id = $2`, [userId, clubId]);
    return { ok: true, clubId, muted: false };
  }

  private async sendPush(allTargets: PushTarget[]) {
    const targets = await this.filterByPreferences(allTargets);
    if (targets.length === 0) return;
    const userIds = [...new Set(targets.map((target) => target.payload.userId))];
    const tokens = await this.db.query<{ user_id: string; token: string }>(
      `SELECT user_id, token FROM user_push_tokens WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );
    const tokensByUser = new Map<string, string[]>();
    for (const row of tokens.rows) {
      const list = tokensByUser.get(row.user_id) ?? [];
      list.push(row.token);
      tokensByUser.set(row.user_id, list);
    }

    const types = [...new Set(targets.map((target) => target.payload.type))].join(',');
    const withoutTokens = userIds.filter((userId) => !tokensByUser.has(userId)).length;
    if (withoutTokens > 0) {
      this.logger.log(`Push omitido type=${types}: ${withoutTokens} usuario(s) sin tokens registrados`);
    }

    const messages: ExpoMessage[] = [];
    for (const { payload, notificationId } of targets) {
      for (const token of tokensByUser.get(payload.userId) ?? []) {
        messages.push({
          to: token,
          title: payload.title,
          body: payload.body,
          sound: 'default',
          // Android: sin channelId / priority high las push pueden no mostrarse (Doze / canal).
          channelId: 'default',
          priority: 'high',
          data: { ...(payload.data ?? {}), type: payload.type, notificationId },
        });
      }
    }
    if (messages.length === 0) return;

    const staleTokens: string[] = [];
    const receiptTokens = new Map<string, string>();
    let failed = 0;
    for (const batch of chunk(messages, EXPO_PUSH_BATCH_SIZE)) {
      const response = await this.postToExpo<{ data?: ExpoPushResult[] }>(EXPO_PUSH_URL, batch);
      if (!response?.data) {
        failed += batch.length;
        continue;
      }
      response.data.forEach((ticket, index) => {
        const token = batch[index]?.to;
        if (ticket.status === 'ok' && ticket.id) {
          if (token) receiptTokens.set(ticket.id, token);
          return;
        }
        failed += 1;
        const errorCode = ticket.details?.error;
        if (errorCode === 'DeviceNotRegistered' && token) {
          staleTokens.push(token);
          return;
        }
        // InvalidCredentials / MismatchSenderId = FCM mal configurado en EAS (solo Android).
        this.logger.warn(
          `Expo push ticket error token=${token?.slice(0, 24) ?? '?'}… code=${errorCode ?? 'unknown'} message=${ticket.message ?? ''}`,
        );
      });
    }
    await this.deleteTokens(staleTokens);

    this.logger.log(
      `Push enviado a Expo type=${types} mensajes=${messages.length} tickets=${receiptTokens.size} fallidos=${failed}`,
    );
    if (receiptTokens.size > 0) {
      setTimeout(() => {
        void this.checkPushReceipts(receiptTokens).catch((error: unknown) => {
          this.logger.warn(`No se pudieron leer recibos de Expo: ${(error as Error).message}`);
        });
      }, PUSH_RECEIPT_DELAY_MS);
    }
  }

  /** Reintenta con espera exponencial ante 429 (rate limit), 5xx o errores de red. */
  private async postToExpo<T>(url: string, body: unknown): Promise<T | null> {
    for (let attempt = 0; attempt <= EXPO_MAX_RETRIES; attempt++) {
      let retryAfterMs: number | null = null;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (res.ok) return (await res.json()) as T;
        if (res.status !== 429 && res.status < 500) {
          this.logger.warn(`Expo HTTP ${res.status} en ${url}: ${await res.text()}`);
          return null;
        }
        const retryAfter = Number(res.headers.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = retryAfter * 1000;
        this.logger.warn(`Expo HTTP ${res.status} en ${url} (intento ${attempt + 1})`);
      } catch (error) {
        this.logger.warn(`Expo error de red en ${url} (intento ${attempt + 1}): ${(error as Error).message}`);
      }
      if (attempt < EXPO_MAX_RETRIES) {
        await sleep(retryAfterMs ?? EXPO_RETRY_BASE_MS * 2 ** attempt);
      }
    }
    this.logger.warn(`Expo: se agotaron los reintentos en ${url}`);
    return null;
  }

  /** Los errores de FCM/APNs (credenciales, token inválido) solo aparecen en los recibos, no en el ticket. */
  private async checkPushReceipts(receiptTokens: Map<string, string>) {
    const staleTokens: string[] = [];
    let delivered = 0;
    let pending = 0;
    for (const ids of chunk([...receiptTokens.keys()], EXPO_RECEIPT_BATCH_SIZE)) {
      const payload = await this.postToExpo<{ data?: Record<string, ExpoPushResult> }>(
        EXPO_RECEIPTS_URL,
        { ids },
      );
      if (!payload) continue;
      for (const ticketId of ids) {
        const receipt = payload.data?.[ticketId];
        if (!receipt) {
          pending += 1;
          continue;
        }
        if (receipt.status === 'ok') {
          delivered += 1;
          continue;
        }
        const token = receiptTokens.get(ticketId) ?? '';
        const errorCode = receipt.details?.error;
        if (errorCode === 'DeviceNotRegistered' && token) staleTokens.push(token);
        this.logger.warn(
          `Push recibo error ticket=${ticketId} token=${token.slice(0, 24)}… code=${errorCode ?? 'unknown'} message=${receipt.message ?? ''}`,
        );
      }
    }
    this.logger.log(`Push recibos: entregados a FCM/APNs=${delivered} pendientes=${pending}`);
    await this.deleteTokens(staleTokens);
  }

  private async deleteTokens(tokens: string[]) {
    if (tokens.length === 0) return;
    await this.db.query(`DELETE FROM user_push_tokens WHERE token = ANY($1::text[])`, [tokens]);
  }
}
