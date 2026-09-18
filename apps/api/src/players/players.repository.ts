import { Injectable } from '@nestjs/common';
import { getMonthKey } from '../common/utils';
import { DatabaseService } from '../database/database.service';
import { UpdatePlayerDto } from './dto/update-player.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PlayersRepository {
  constructor(private readonly db: DatabaseService) {}

  async getByUserId(userId: string) {
    const result = await this.db.query(
      `SELECT p.*, u.name, u.email
       FROM players p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async updateMe(userId: string, dto: UpdatePlayerDto) {
    await this.db.query(
      `UPDATE players
       SET nickname = COALESCE($2, nickname),
           city = COALESCE($3, city),
           level = COALESCE($4, level),
           position = COALESCE($5, position),
           bio = COALESCE($6, bio),
           photo_url = COALESCE($7, photo_url),
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        userId,
        dto.nickname ?? null,
        dto.city ?? null,
        dto.level ?? null,
        dto.position ?? null,
        dto.bio ?? null,
        dto.photoUrl ?? null,
      ],
    );
    return this.getByUserId(userId);
  }

  async listPlayers(limit = 20, offset = 0) {
    const result = await this.db.query(
      `SELECT p.*, u.name
       FROM players p
       INNER JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  async getById(playerId: string) {
    const result = await this.db.query(
      `SELECT p.*, u.name
       FROM players p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [playerId],
    );
    return result.rows[0] ?? null;
  }

  async getPublicProfileExtras(
    userId: string,
    extras: Record<string, unknown>,
  ): Promise<{
    competitiveMonthly: { monthKey: string; points: number; matchesPlayed: number };
    mainClubId?: string;
    mainClub?: { id: string; name: string; city?: string };
  }> {
    const monthKey = getMonthKey();
    const competitive = await this.db.query(
      `SELECT points, matches_played FROM player_competitive_monthly_points
       WHERE user_id = $1 AND month_key = $2`,
      [userId, monthKey],
    );
    const competitiveRow = competitive.rows[0];

    const rawClubId = extras.mainClubId;
    const mainClubId =
      typeof rawClubId === 'string' && UUID_RE.test(rawClubId) ? rawClubId : undefined;

    let mainClub: { id: string; name: string; city?: string } | undefined;
    if (mainClubId) {
      const c = await this.db.query(
        `SELECT id, name, city FROM clubs WHERE id = $1`,
        [mainClubId],
      );
      if (c.rows[0]) {
        mainClub = {
          id: c.rows[0].id,
          name: c.rows[0].name,
          city: c.rows[0].city ?? undefined,
        };
      }
    }

    return {
      competitiveMonthly: {
        monthKey,
        points: Number(competitiveRow?.points ?? 0),
        matchesPlayed: Number(competitiveRow?.matches_played ?? 0),
      },
      mainClubId,
      mainClub,
    };
  }

  searchPlayers(query: string, excludeUserId: string, limit = 20) {
    const pattern = `%${query.trim()}%`;
    return this.db.query(
      `SELECT p.id,
              p.user_id,
              u.name,
              p.nickname,
              p.level,
              p.rating,
              p.photo_url,
              p.city,
              p.extras,
              p.category_status,
              p.placement_matches_played
       FROM players p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.user_id <> $1
         AND u.role = 'PLAYER'
         AND (
           u.name ILIKE $2
           OR COALESCE(p.nickname, '') ILIKE $2
           OR u.email ILIKE $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM blocked_users bu
           WHERE (bu.blocker_id = $1 AND bu.blocked_id = p.user_id)
              OR (bu.blocker_id = p.user_id AND bu.blocked_id = $1)
         )
       ORDER BY u.name ASC
       LIMIT $3`,
      [excludeUserId, pattern, limit],
    );
  }
}
