import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class FollowsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly reportsService: ReportsService,
  ) {}

  async resolveUserId(playerOrUserId: string): Promise<string> {
    const byUser = await this.db.query(`SELECT id FROM users WHERE id = $1`, [playerOrUserId]);
    if (byUser.rows[0]) return playerOrUserId;
    const byPlayer = await this.db.query(`SELECT user_id FROM players WHERE id = $1`, [
      playerOrUserId,
    ]);
    if (byPlayer.rows[0]?.user_id) return byPlayer.rows[0].user_id;
    throw new NotFoundException('Usuario no encontrado');
  }

  async getCounts(userIdOrPlayerId: string) {
    const userId = await this.resolveUserId(userIdOrPlayerId);
    const result = await this.db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM user_follows WHERE following_id = $1) AS followers,
         (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = $1) AS following`,
      [userId],
    );
    return {
      followers: result.rows[0]?.followers ?? 0,
      following: result.rows[0]?.following ?? 0,
    };
  }

  async listFollowers(userIdOrPlayerId: string, limit = 50) {
    const userId = await this.resolveUserId(userIdOrPlayerId);
    const result = await this.db.query(
      `SELECT u.id AS user_id, u.name, p.photo_url, p.nickname, f.created_at
       FROM user_follows f
       INNER JOIN users u ON u.id = f.follower_id
       LEFT JOIN players p ON p.user_id = u.id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows;
  }

  async listFollowing(userIdOrPlayerId: string, limit = 50) {
    const userId = await this.resolveUserId(userIdOrPlayerId);
    const result = await this.db.query(
      `SELECT u.id AS user_id, u.name, p.photo_url, p.nickname, f.created_at
       FROM user_follows f
       INNER JOIN users u ON u.id = f.following_id
       LEFT JOIN players p ON p.user_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows;
  }

  async getRelation(viewerId: string, targetIdOrPlayerId: string) {
    const targetId = await this.resolveUserId(targetIdOrPlayerId);
    if (viewerId === targetId) return { status: 'self' as const, following: false };
    const result = await this.db.query(
      `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [viewerId, targetId],
    );
    return { status: 'ok' as const, following: !!result.rows[0] };
  }

  async follow(userId: string, targetIdOrPlayerId: string) {
    const targetId = await this.resolveUserId(targetIdOrPlayerId);
    if (userId === targetId) {
      throw new BadRequestException('No podés seguirte a vos mismo');
    }
    const userExists = await this.db.query(`SELECT id FROM users WHERE id = $1`, [targetId]);
    if (!userExists.rows[0]) throw new NotFoundException('Usuario no encontrado');

    await this.reportsService.assertNotBlockedEitherWay(userId, targetId);

    await this.db.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, targetId],
    );
    return this.getRelation(userId, targetId);
  }

  async unfollow(userId: string, targetIdOrPlayerId: string) {
    const targetId = await this.resolveUserId(targetIdOrPlayerId);
    await this.db.query(
      `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [userId, targetId],
    );
    return this.getRelation(userId, targetId);
  }

}
