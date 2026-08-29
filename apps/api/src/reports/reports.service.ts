import {
  BadRequestException,
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

    return { blocked: true };
  }
}
