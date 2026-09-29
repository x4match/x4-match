import { Injectable } from '@nestjs/common';
import { getMonthKey } from '../common/utils';
import { DatabaseService } from '../database/database.service';
import { UpdatePlayerDto } from './dto/update-player.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TournamentTitle = {
  tournamentId: string;
  name: string;
  category: string | null;
  gender: string | null;
  format: 'ELIMINATION' | 'LEAGUE';
  clubId: string | null;
  clubName: string | null;
  clubCity: string | null;
  circuitName: string | null;
  flyerUrl: string | null;
  partnerName: string | null;
  partnerUserId: string | null;
  wonAt: string | null;
};

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
           position = COALESCE($4, position),
           bio = COALESCE($5, bio),
           photo_url = COALESCE($6, photo_url),
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        userId,
        dto.nickname ?? null,
        dto.city ?? null,
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

  /**
   * Torneos en los que la pareja del usuario salió campeona:
   * - Llave eliminatoria: ganó la final (partido sin siguiente cruce).
   * - Liga / cancha abierta finalizada: primera en la tabla sin empate en la cima.
   */
  async getTournamentTitles(userId: string): Promise<TournamentTitle[]> {
    const tournamentColumns = `
      t.id AS tournament_id,
      t.name,
      t.category,
      t.gender,
      c.id AS club_id,
      c.name AS club_name,
      c.city AS club_city,
      circ.name AS circuit_name,
      (
        SELECT tp.photo_url
        FROM tournament_photos tp
        WHERE tp.tournament_id = t.id
        ORDER BY
          CASE WHEN lower(COALESCE(tp.caption, '')) = 'flyer' THEN 0 ELSE 1 END,
          tp.created_at DESC
        LIMIT 1
      ) AS flyer_url,
      COALESCE(
        (SELECT MAX(td.play_date) FROM tournament_dates td WHERE td.tournament_id = t.id),
        t.start_date
      ) AS played_at`;

    const bracketRes = await this.db.query(
      `SELECT DISTINCT ON (t.id)
              ${tournamentColumns},
              COALESCE(tm.finished_at, t.start_date) AS won_at,
              r.player1_user_id, r.player2_user_id, r.player1_name, r.player2_name
       FROM tournament_matches tm
       INNER JOIN tournaments t ON t.id = tm.tournament_id
       INNER JOIN tournament_registrations r ON r.id = tm.winner_registration_id
       LEFT JOIN clubs c ON c.id = t.club_id
       LEFT JOIN circuits circ ON circ.id = t.circuit_id
       WHERE (r.player1_user_id = $1 OR r.player2_user_id = $1)
         AND t.status <> 'CANCELLED'
         AND tm.status = 'FINISHED'
         AND tm.next_match_id IS NULL
         AND (
           tm.round_label ~* '^\\s*(gran\\s+)?final\\s*$'
           OR EXISTS (SELECT 1 FROM tournament_matches ch WHERE ch.next_match_id = tm.id)
         )
       ORDER BY t.id, tm.round DESC, tm.finished_at DESC NULLS LAST`,
      [userId],
    );

    const leagueRes = await this.db.query(
      `SELECT ${tournamentColumns},
              COALESCE(
                (SELECT MAX(m.finished_at) FROM tournament_matches m WHERE m.tournament_id = t.id),
                t.updated_at
              ) AS won_at,
              r.id AS registration_id,
              r.player1_user_id, r.player2_user_id, r.player1_name, r.player2_name
       FROM tournament_registrations r
       INNER JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN clubs c ON c.id = t.club_id
       LEFT JOIN circuits circ ON circ.id = t.circuit_id
       WHERE (r.player1_user_id = $1 OR r.player2_user_id = $1)
         AND r.status = 'APPROVED'
         AND t.status = 'FINISHED'
         AND EXISTS (
           SELECT 1 FROM tournament_matches m
           WHERE m.tournament_id = t.id AND m.status = 'FINISHED'
         )
         AND NOT EXISTS (
           SELECT 1 FROM tournament_matches m
           WHERE m.tournament_id = t.id
             AND (
               m.next_match_id IS NOT NULL
               OR m.round_label ~* '(final|semi|cuartos|octavos)'
             )
         )`,
      [userId],
    );

    const leagueWins: any[] = [];
    for (const row of leagueRes.rows) {
      const leaderId = await this.resolveLeagueLeader(row.tournament_id);
      if (leaderId === row.registration_id) leagueWins.push(row);
    }

    const toTitle = (row: any, format: TournamentTitle['format']): TournamentTitle => {
      const isPlayer1 = row.player1_user_id === userId;
      return {
        tournamentId: row.tournament_id,
        name: row.name,
        category: row.category ?? null,
        gender: row.gender ?? null,
        format,
        clubId: row.club_id ?? null,
        clubName: row.club_name ?? null,
        clubCity: row.club_city ?? null,
        circuitName: row.circuit_name ?? null,
        flyerUrl: row.flyer_url ?? null,
        partnerName: (isPlayer1 ? row.player2_name : row.player1_name) ?? null,
        partnerUserId: (isPlayer1 ? row.player2_user_id : row.player1_user_id) ?? null,
        wonAt: row.played_at ?? row.won_at ?? null,
      };
    };

    return [
      ...bracketRes.rows.map((row) => toTitle(row, 'ELIMINATION')),
      ...leagueWins.map((row) => toTitle(row, 'LEAGUE')),
    ].sort((a, b) => {
      const ta = a.wonAt ? new Date(a.wonAt).getTime() : 0;
      const tb = b.wonAt ? new Date(b.wonAt).getTime() : 0;
      return tb - ta;
    });
  }

  private async resolveLeagueLeader(tournamentId: string): Promise<string | null> {
    const matches = await this.db.query(
      `SELECT team_a_registration_id, team_b_registration_id, winner_registration_id, score
       FROM tournament_matches
       WHERE tournament_id = $1 AND status = 'FINISHED'`,
      [tournamentId],
    );

    const table = new Map<string, { points: number; setDiff: number }>();
    const row = (id: string) => {
      let entry = table.get(id);
      if (!entry) {
        entry = { points: 0, setDiff: 0 };
        table.set(id, entry);
      }
      return entry;
    };

    for (const m of matches.rows) {
      if (!m.team_a_registration_id || !m.team_b_registration_id) continue;
      const a = row(m.team_a_registration_id);
      const b = row(m.team_b_registration_id);
      const setsA = Number(m.score?.setsA ?? 0);
      const setsB = Number(m.score?.setsB ?? 0);
      a.setDiff += setsA - setsB;
      b.setDiff += setsB - setsA;
      if (m.winner_registration_id === m.team_a_registration_id) a.points += 3;
      else if (m.winner_registration_id === m.team_b_registration_id) b.points += 3;
    }

    const ranked = [...table.entries()].sort(
      ([, x], [, y]) => y.points - x.points || y.setDiff - x.setDiff,
    );
    if (!ranked.length) return null;
    const [leaderId, leader] = ranked[0];
    const runnerUp = ranked[1]?.[1];
    if (runnerUp && runnerUp.points === leader.points && runnerUp.setDiff === leader.setDiff) {
      return null;
    }
    return leaderId;
  }

  searchPlayers(query: string, excludeUserId: string, limit = 20) {
    const pattern = `%${query.trim()}%`;
    return this.db.query(
      `SELECT p.id,
              p.user_id,
              u.name,
              p.nickname,
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
