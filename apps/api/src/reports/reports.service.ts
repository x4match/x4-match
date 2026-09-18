import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async createReport(data: {
    reporterId: string;
    reportedUserId: string;
    matchId?: string;
    reason: string;
  }) {
    const reason = data.reason?.trim();
    if (!reason) {
      throw new BadRequestException('El motivo del reporte es obligatorio');
    }

    if (data.reporterId === data.reportedUserId) {
      throw new BadRequestException('No podés reportarte a vos mismo');
    }

    const user = await this.db.query(`SELECT id FROM users WHERE id = $1`, [
      data.reportedUserId,
    ]);
    if (!user.rows[0]) {
      throw new NotFoundException('Usuario reportado no encontrado');
    }

    const result = await this.db.query(
      `INSERT INTO user_reports (reporter_id, reported_user_id, match_id, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reporter_id, reported_user_id, match_id, reason, created_at`,
      [data.reporterId, data.reportedUserId, data.matchId ?? null, reason],
    );

    return result.rows[0];
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('No podés bloquearte a vos mismo');
    }

    const user = await this.db.query(`SELECT id FROM users WHERE id = $1`, [blockedId]);
    if (!user.rows[0]) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.db.query(
      `INSERT INTO blocked_users (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId],
    );

    // Cortar relaciones sociales existentes en ambas direcciones.
    await this.db.query(
      `DELETE FROM user_follows
       WHERE (follower_id = $1 AND following_id = $2)
          OR (follower_id = $2 AND following_id = $1)`,
      [blockerId, blockedId],
    );
    await this.db.query(
      `UPDATE friend_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE status = 'pending'
         AND (
           (requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1)
         )`,
      [blockerId, blockedId],
    );

    return { blocked: true };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('No podés desbloquearte a vos mismo');
    }

    const result = await this.db.query(
      `DELETE FROM blocked_users
       WHERE blocker_id = $1 AND blocked_id = $2
       RETURNING id`,
      [blockerId, blockedId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundException('Este usuario no está en tu lista de bloqueados');
    }

    return { blocked: false };
  }

  async listBlockedUsers(blockerId: string) {
    const result = await this.db.query(
      `SELECT bu.blocked_id AS user_id,
              bu.created_at AS blocked_at,
              u.name,
              p.nickname,
              p.photo_url
       FROM blocked_users bu
       INNER JOIN users u ON u.id = bu.blocked_id
       LEFT JOIN players p ON p.user_id = bu.blocked_id
       WHERE bu.blocker_id = $1
       ORDER BY bu.created_at DESC`,
      [blockerId],
    );
    return result.rows;
  }

  /** True si hay bloqueo en cualquier dirección entre ambos usuarios. */
  async areBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
    if (!userA || !userB || userA === userB) return false;
    const result = await this.db.query(
      `SELECT 1 FROM blocked_users
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [userA, userB],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async assertNotBlockedEitherWay(userA: string, userB: string | null | undefined) {
    if (!userB) return;
    if (await this.areBlockedEitherWay(userA, userB)) {
      throw new ForbiddenException('No podés interactuar con este usuario');
    }
  }

  async assertNotBlockedWithAny(userId: string, otherUserIds: Array<string | null | undefined>) {
    const ids = [...new Set(otherUserIds.filter((id): id is string => !!id && id !== userId))];
    if (!ids.length) return;

    const result = await this.db.query(
      `SELECT 1 FROM blocked_users
       WHERE (blocker_id = $1 AND blocked_id = ANY($2::uuid[]))
          OR (blocked_id = $1 AND blocker_id = ANY($2::uuid[]))
       LIMIT 1`,
      [userId, ids],
    );
    if ((result.rowCount ?? 0) > 0) {
      throw new ForbiddenException('No podés interactuar con este usuario');
    }
  }
}
