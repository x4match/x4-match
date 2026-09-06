import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type PushPlatform = 'ios' | 'android';

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
    void this.sendPushToUser(params).catch((error: unknown) => {
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

  private async sendPushToUser(params: NotificationPayload) {
    const tokens = await this.db.query(
      `SELECT token FROM user_push_tokens WHERE user_id = $1`,
      [params.userId],
    );
    if (tokens.rows.length === 0) return;

    const messages = tokens.rows.map((row) => ({
      to: row.token,
      title: params.title,
      body: params.body,
      sound: 'default',
      data: {
        ...(params.data ?? {}),
        type: params.type,
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

    const payload = (await res.json()) as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    };
    const staleTokens: string[] = [];
    payload.data?.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const token = tokens.rows[index]?.token;
        if (token) staleTokens.push(token);
      }
    });
    if (staleTokens.length > 0) {
      await this.db.query(`DELETE FROM user_push_tokens WHERE token = ANY($1::text[])`, [
        staleTokens,
      ]);
    }
  }
}
