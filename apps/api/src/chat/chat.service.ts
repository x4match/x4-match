import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { isClubRole } from '../common/roles';
import { DatabaseService } from '../database/database.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly db: DatabaseService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getMatchMessages(matchId: string, userId: string) {
    await this.assertNotClubAccount(userId);
    await this.assertParticipant(matchId, userId);
    const chatId = await this.getOrCreateMatchChat(matchId);
    const result = await this.db.query(
      `SELECT m.id, m.content, m.created_at, u.id AS sender_user_id, u.name AS sender_name
       FROM messages m
       INNER JOIN users u ON u.id = m.sender_user_id
       WHERE m.chat_id = $1
       ORDER BY m.created_at ASC`,
      [chatId],
    );
    return result.rows;
  }

  async createMessage(matchId: string, userId: string, content: string) {
    await this.assertNotClubAccount(userId);
    await this.assertParticipant(matchId, userId);
    const chatId = await this.getOrCreateMatchChat(matchId);
    const result = await this.db.query(
      `INSERT INTO messages (chat_id, sender_user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, chat_id, sender_user_id, content, created_at`,
      [chatId, userId, content],
    );
    this.realtimeGateway.emitNewMessage(matchId, result.rows[0]);
    return result.rows[0];
  }

  private async getOrCreateMatchChat(matchId: string) {
    await this.db.query(
      `INSERT INTO chats (match_id, type)
       VALUES ($1, 'MATCH')
       ON CONFLICT (match_id) DO NOTHING`,
      [matchId],
    );
    const chat = await this.db.query(`SELECT id FROM chats WHERE match_id = $1`, [matchId]);
    return chat.rows[0].id;
  }

  private async assertNotClubAccount(userId: string) {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (isClubRole(result.rows[0]?.role)) {
      throw new ForbiddenException('Las cuentas de club usan chats directos, no el chat de partidos');
    }
  }

  private async assertParticipant(matchId: string, userId: string) {
    const result = await this.db.query(
      `SELECT 1
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND p.user_id = $2 AND mp.status IN ('JOINED', 'CONFIRMED')
       LIMIT 1`,
      [matchId, userId],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException('No participas de este partido');
    }
  }
}
