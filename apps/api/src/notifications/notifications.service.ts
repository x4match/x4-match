import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type PushPlatform = 'ios' | 'android';

type ExpoPushResult = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string; fault?: string };
};

/** Expo recomienda esperar ~15 min; 30 s alcanza para la mayoría de los recibos y sirve para diagnosticar. */
const PUSH_RECEIPT_DELAY_MS = 30_000;

type NotificationPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(params: NotificationPayload) {
    const result = await this.db.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id`,
      [
        params.userId,
        params.type,
        params.title,
        params.body,
        JSON.stringify(params.data ?? {}),
      ],
    );
    void this.sendPushToUser(params, result.rows[0].id).catch((error: unknown) => {
      this.logger.warn(`Push no enviado: ${(error as Error).message}`);
    });
    return result.rows[0];
  }

  async createMany(items: NotificationPayload[]) {
    const created = [];
    for (const item of items) {
      created.push(await this.create(item));
    }
    return created;
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

  private async sendPushToUser(params: NotificationPayload, notificationId: string) {
    const tokens = await this.db.query(
      `SELECT token FROM user_push_tokens WHERE user_id = $1`,
      [params.userId],
    );
    if (tokens.rows.length === 0) {
      this.logger.log(`Push omitido type=${params.type} user=${params.userId}: sin tokens registrados`);
      return;
    }

    const messages = tokens.rows.map((row) => ({
      to: row.token,
      title: params.title,
      body: params.body,
      sound: 'default',
      // Android: sin channelId / priority high las push pueden no mostrarse (Doze / canal).
      channelId: 'default',
      priority: 'high' as const,
      data: {
        ...(params.data ?? {}),
        type: params.type,
        notificationId,
      },
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      this.logger.warn(`Expo push HTTP ${res.status}`);
      return;
    }

    const payload = (await res.json()) as { data?: ExpoPushResult[] };
    const staleTokens: string[] = [];
    const receiptTokens = new Map<string, string>();
    payload.data?.forEach((ticket, index) => {
      const token: string | undefined = tokens.rows[index]?.token;
      if (ticket.status === 'ok' && ticket.id) {
        if (token) receiptTokens.set(ticket.id, token);
        return;
      }
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
    await this.deleteTokens(staleTokens);

    if (receiptTokens.size > 0) {
      this.logger.log(
        `Push enviado a Expo type=${params.type} user=${params.userId} tickets=${[...receiptTokens.keys()].join(',')}`,
      );
      setTimeout(() => {
        void this.checkPushReceipts(receiptTokens).catch((error: unknown) => {
          this.logger.warn(`No se pudieron leer recibos de Expo: ${(error as Error).message}`);
        });
      }, PUSH_RECEIPT_DELAY_MS);
    }
  }

  /** Los errores de FCM/APNs (credenciales, token inválido) solo aparecen en los recibos, no en el ticket. */
  private async checkPushReceipts(receiptTokens: Map<string, string>) {
    const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: [...receiptTokens.keys()] }),
    });
    if (!res.ok) {
      this.logger.warn(`Expo receipts HTTP ${res.status}`);
      return;
    }

    const payload = (await res.json()) as { data?: Record<string, ExpoPushResult> };
    const staleTokens: string[] = [];
    for (const [ticketId, token] of receiptTokens) {
      const receipt = payload.data?.[ticketId];
      if (!receipt) {
        this.logger.log(`Push recibo pendiente ticket=${ticketId}`);
        continue;
      }
      if (receipt.status === 'ok') {
        this.logger.log(`Push entregado a FCM/APNs ticket=${ticketId}`);
        continue;
      }
      const errorCode = receipt.details?.error;
      if (errorCode === 'DeviceNotRegistered') staleTokens.push(token);
      this.logger.warn(
        `Push recibo error ticket=${ticketId} token=${token.slice(0, 24)}… code=${errorCode ?? 'unknown'} message=${receipt.message ?? ''}`,
      );
    }
    await this.deleteTokens(staleTokens);
  }

  private async deleteTokens(tokens: string[]) {
    if (tokens.length === 0) return;
    await this.db.query(`DELETE FROM user_push_tokens WHERE token = ANY($1::text[])`, [tokens]);
  }
}
