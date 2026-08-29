import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateClubCommentDto } from './dto/create-club-comment.dto';

@Injectable()
export class ClubCommentsService {
  constructor(private readonly db: DatabaseService) {}

  async list(clubId: string, limit = 50) {
    const club = await this.db.query(`SELECT id FROM clubs WHERE id = $1`, [clubId]);
    if (!club.rows[0]) {
      throw new NotFoundException('Club no encontrado');
    }

    const result = await this.db.query(
      `SELECT cc.id,
              cc.club_id,
              cc.user_id,
              cc.body,
              cc.created_at,
              u.name AS user_name,
              p.nickname,
              p.photo_url
       FROM club_comments cc
       INNER JOIN users u ON u.id = cc.user_id
       LEFT JOIN players p ON p.user_id = cc.user_id
       WHERE cc.club_id = $1
       ORDER BY cc.created_at DESC
       LIMIT $2`,
      [clubId, limit],
    );

    return result.rows;
  }

  async create(clubId: string, userId: string, dto: CreateClubCommentDto) {
    const club = await this.db.query(`SELECT id FROM clubs WHERE id = $1`, [clubId]);
    if (!club.rows[0]) {
      throw new NotFoundException('Club no encontrado');
    }

    const body = dto.body.trim();
    const result = await this.db.query(
      `INSERT INTO club_comments (club_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, club_id, user_id, body, created_at`,
      [clubId, userId, body],
    );

    const row = result.rows[0];
    const author = await this.db.query(
      `SELECT u.name AS user_name, p.nickname, p.photo_url
       FROM users u
       LEFT JOIN players p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    return { ...row, ...author.rows[0] };
  }
}
