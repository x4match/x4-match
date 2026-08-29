import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async resolveUserId(playerOrUserId: string): Promise<string> {
    const byUser = await this.db.query(`SELECT id FROM users WHERE id = $1`, [playerOrUserId]);
    if (byUser.rows[0]) return playerOrUserId;
    const byPlayer = await this.db.query(`SELECT user_id FROM players WHERE id = $1`, [playerOrUserId]);
    if (byPlayer.rows[0]?.user_id) return byPlayer.rows[0].user_id;
    throw new NotFoundException('Usuario no encontrado');
  }

  async listFriends(userId: string) {
    const result = await this.db.query(
      `SELECT
         fr.id AS request_id,
         CASE WHEN fr.requester_id = $1 THEN fr.addressee_id ELSE fr.requester_id END AS user_id,
         u.name,
         u.photo,
         p.photo_url,
         p.nickname,
         fr.updated_at
       FROM friend_requests fr
       INNER JOIN users u ON u.id = CASE WHEN fr.requester_id = $1 THEN fr.addressee_id ELSE fr.requester_id END
       LEFT JOIN players p ON p.user_id = u.id
       WHERE fr.status = 'accepted'
         AND (fr.requester_id = $1 OR fr.addressee_id = $1)
       ORDER BY u.name ASC`,
      [userId],
    );
    return result.rows;
  }

  async listPending(userId: string) {
    const incoming = await this.db.query(
      `SELECT fr.id, fr.requester_id, fr.created_at, u.name, p.photo_url, p.nickname
       FROM friend_requests fr
       INNER JOIN users u ON u.id = fr.requester_id
       LEFT JOIN players p ON p.user_id = u.id
       WHERE fr.addressee_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId],
    );
    const outgoing = await this.db.query(
      `SELECT fr.id, fr.addressee_id AS user_id, fr.created_at, u.name, p.photo_url
       FROM friend_requests fr
       INNER JOIN users u ON u.id = fr.addressee_id
       LEFT JOIN players p ON p.user_id = u.id
       WHERE fr.requester_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId],
    );
    return { incoming: incoming.rows, outgoing: outgoing.rows };
  }

  async sendRequest(userId: string, targetId: string) {
    const otherUserId = await this.resolveUserId(targetId);
    if (userId === otherUserId) {
      throw new BadRequestException('No podés agregarte a vos mismo');
    }
    const existing = await this.db.query(
      `SELECT id, status, requester_id FROM friend_requests
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [userId, otherUserId],
    );
    const row = existing.rows[0];
    if (row?.status === 'accepted') {
      throw new BadRequestException('Ya son amigos');
    }
    if (row?.status === 'pending') {
      throw new BadRequestException(
        row.requester_id === userId ? 'Ya enviaste una solicitud de amistad' : 'Ya tenés una solicitud pendiente de este usuario',
      );
    }
    const result = await this.db.query(
      `INSERT INTO friend_requests (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (requester_id, addressee_id) DO UPDATE
         SET status = 'pending', updated_at = NOW()
       RETURNING id, status, created_at`,
      [userId, otherUserId],
    );
    const requester = await this.db.query(`SELECT name FROM users WHERE id = $1`, [userId]);
    const requesterName = requester.rows[0]?.name || 'Alguien';
    await this.notifications.create({
      userId: otherUserId,
      type: 'FRIEND_REQUEST',
      title: 'Nueva solicitud de amistad',
      body: `${requesterName} quiere ser tu amigo`,
      data: {
        requestId: result.rows[0].id,
        fromUserId: userId,
        fromUserName: requesterName,
      },
    });
    return result.rows[0];
  }

  async acceptRequest(userId: string, requestId: string) {
    const result = await this.db.query(
      `UPDATE friend_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
       RETURNING id, requester_id, addressee_id, status`,
      [requestId, userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Solicitud no encontrada o ya procesada');
    }
    const row = result.rows[0];
    try {
      await this.db.query(
        `INSERT INTO user_follows (follower_id, following_id)
         VALUES ($1, $2), ($2, $1)
         ON CONFLICT DO NOTHING`,
        [row.requester_id, row.addressee_id],
      );
    } catch {
      // Tabla user_follows puede no existir aún si la migración no corrió.
    }
    return row;
  }

  async rejectRequest(userId: string, requestId: string) {
    const result = await this.db.query(
      `UPDATE friend_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
       RETURNING id, status`,
      [requestId, userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Solicitud no encontrada o ya procesada');
    }
    return result.rows[0];
  }

  async removeFriend(userId: string, friendId: string) {
    const otherUserId = await this.resolveUserId(friendId);
    const result = await this.db.query(
      `DELETE FROM friend_requests
       WHERE status = 'accepted'
         AND (
           (requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1)
         )
       RETURNING id`,
      [userId, otherUserId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('No son amigos');
    }
    return { ok: true };
  }

  async getRelation(userId: string, targetId: string) {
    const otherUserId = await this.resolveUserId(targetId);
    if (userId === otherUserId) return { status: 'self' as const };
    const result = await this.db.query(
      `SELECT id, status, requester_id, addressee_id FROM friend_requests
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)
       ORDER BY updated_at DESC LIMIT 1`,
      [userId, otherUserId],
    );
    const row = result.rows[0];
    if (!row) return { status: 'none' as const };
    if (row.status === 'accepted') return { status: 'friends' as const, requestId: row.id };
    if (row.status === 'pending') {
      return {
        status: row.requester_id === userId ? ('pending_outgoing' as const) : ('pending_incoming' as const),
        requestId: row.id,
      };
    }
    return { status: 'none' as const };
  }
}
