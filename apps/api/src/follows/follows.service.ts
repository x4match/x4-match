import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FriendsService } from '../friends/friends.service';

@Injectable()
export class FollowsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly friends: FriendsService,
  ) {}

  async getCounts(userIdOrPlayerId: string) {
    const userId = await this.friends.resolveUserId(userIdOrPlayerId);
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
    const userId = await this.friends.resolveUserId(userIdOrPlayerId);
    const result = await this.db.query(
      `SELECT u.id AS user_id, u.name, u.photo, p.photo_url, p.nickname, f.created_at
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
    const userId = await this.friends.resolveUserId(userIdOrPlayerId);
    const result = await this.db.query(
      `SELECT u.id AS user_id, u.name, u.photo, p.photo_url, p.nickname, f.created_at
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
    const targetId = await this.friends.resolveUserId(targetIdOrPlayerId);
    if (viewerId === targetId) return { status: 'self' as const, following: false };
    const result = await this.db.query(
      `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [viewerId, targetId],
    );
    return { status: 'ok' as const, following: !!result.rows[0] };
  }

  async follow(userId: string, targetIdOrPlayerId: string) {
    const targetId = await this.friends.resolveUserId(targetIdOrPlayerId);
    if (userId === targetId) {
      throw new BadRequestException('No podés seguirte a vos mismo');
    }
    const userExists = await this.db.query(`SELECT id FROM users WHERE id = $1`, [targetId]);
    if (!userExists.rows[0]) throw new NotFoundException('Usuario no encontrado');

    await this.db.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, targetId],
    );
    return this.getRelation(userId, targetId);
  }

  async unfollow(userId: string, targetIdOrPlayerId: string) {
    const targetId = await this.friends.resolveUserId(targetIdOrPlayerId);
    await this.db.query(
      `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [userId, targetId],
    );
    return this.getRelation(userId, targetId);
  }

  /** Crea follows mutuos (p. ej. al aceptar amistad). */
  async ensureMutual(userA: string, userB: string) {
    if (!userA || !userB || userA === userB) return;
    await this.db.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2), ($2, $1)
       ON CONFLICT DO NOTHING`,
      [userA, userB],
    );
  }
}
