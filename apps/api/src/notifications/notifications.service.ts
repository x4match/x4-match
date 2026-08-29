import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async create(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
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
    return result.rows[0];
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
}
