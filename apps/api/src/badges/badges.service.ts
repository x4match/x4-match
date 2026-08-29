import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { userTeamFromRank } from '../common/utils/match-result.util';
import {
  computeWinStreak,
  evaluateEligibleBadges,
  isComebackWin,
  type BadgeCode,
  type MatchOutcome,
  type PlayerBadgeContext,
} from './badge-definitions';

type SetScore = { teamA: number; teamB: number };

function parseScore(score: string): { a: number; b: number } | null {
  const parts = score.split(/[-:]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { a: parts[0], b: parts[1] };
  }
  return null;
}

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(private readonly db: DatabaseService) {}

  listCatalog() {
    return this.db
      .query(
        `SELECT id, code, name, description, icon, category, sort_order
         FROM badges
         ORDER BY sort_order ASC, name ASC`,
      )
      .then((res) => res.rows);
  }

  async getUserBadges(userId: string) {
    const result = await this.db.query(
      `SELECT b.id, b.code, b.name, b.description, b.icon, b.category, b.sort_order,
              ub.earned_at, ub.match_id
       FROM user_badges ub
       INNER JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      sortOrder: row.sort_order,
      earnedAt: row.earned_at,
      matchId: row.match_id,
    }));
  }

  async getUserBadgesSummary(userId: string) {
    const [catalogRows, earned] = await Promise.all([this.listCatalog(), this.getUserBadges(userId)]);
    const earnedByCode = new Map(earned.map((badge) => [badge.code, badge]));

    const all = catalogRows.map((row) => {
      const earnedBadge = earnedByCode.get(row.code);
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        icon: row.icon,
        category: row.category,
        sortOrder: row.sort_order,
        earned: !!earnedBadge,
        earnedAt: earnedBadge?.earnedAt ?? null,
        matchId: earnedBadge?.matchId ?? null,
      };
    });

    return {
      earned,
      all,
      total: all.length,
      earnedCount: earned.length,
    };
  }

  async evaluateForFinishedMatch(matchId: string): Promise<BadgeCode[]> {
    const matchRes = await this.db.query(
      `SELECT m.id, m.mode, m.club_id, m.date, m.needed_players,
              mr.winner_team, mr.score, mr.sets, mr.result_status
       FROM matches m
       INNER JOIN match_results mr ON mr.match_id = m.id
       WHERE m.id = $1 AND m.status = 'FINISHED'`,
      [matchId],
    );
    const match = matchRes.rows[0];
    if (!match || match.result_status !== 'confirmed') {
      return [];
    }

    const participantsRes = await this.db.query(
      `SELECT p.user_id,
              ROW_NUMBER() OVER (ORDER BY mp.created_at) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );

    const userIds = participantsRes.rows.map((row) => row.user_id as string);
    if (userIds.length === 0) return [];

    const sets = this.parseSets(match.sets);
    const neededPlayers = Number(match.needed_players) || 4;
    const matchHour = new Date(match.date).getHours();
    const awarded: BadgeCode[] = [];

    for (const row of participantsRes.rows) {
      const userId = row.user_id as string;
      const rnk = Number(row.rnk);
      const myTeam = userTeamFromRank(rnk, neededPlayers);
      const winnerTeam = String(match.winner_team || '')
        .toUpperCase()
        .trim();
      const outcome: MatchOutcome =
        winnerTeam === 'A' || winnerTeam === 'B'
          ? myTeam === winnerTeam
            ? 'win'
            : 'loss'
          : 'draw';

      const ctx = await this.buildPlayerContext(userId, {
        matchId,
        outcome,
        mode: String(match.mode || 'friendly'),
        clubId: match.club_id ?? null,
        matchHour,
        isComebackWin: isComebackWin(myTeam, winnerTeam, sets),
      });

      const newlyEarned = await this.awardEligibleBadges(userId, ctx);
      awarded.push(...newlyEarned);
    }

    return awarded;
  }

  private async buildPlayerContext(
    userId: string,
    justFinished: PlayerBadgeContext['justFinished'],
  ): Promise<PlayerBadgeContext> {
    const historyRes = await this.db.query(
      `SELECT m.id AS match_id, m.mode, m.club_id, m.needed_players,
              mr.winner_team, mr.score, mp_rank.rnk
       FROM matches m
       INNER JOIN match_results mr ON mr.match_id = m.id
       INNER JOIN (
         SELECT mp.match_id, mp.player_id,
                ROW_NUMBER() OVER (PARTITION BY mp.match_id ORDER BY mp.created_at) AS rnk
         FROM match_players mp
         WHERE mp.status IN ('JOINED', 'CONFIRMED')
       ) mp_rank ON mp_rank.match_id = m.id
       INNER JOIN players p ON p.id = mp_rank.player_id AND p.user_id = $1
       WHERE m.status = 'FINISHED' AND mr.result_status = 'confirmed'
       ORDER BY m.date ASC, m.id ASC`,
      [userId],
    );

    const outcomes: MatchOutcome[] = [];
    let wins = 0;
    let competitiveMatches = 0;
    const clubCounts = new Map<string, number>();

    for (const row of historyRes.rows) {
      const neededPlayers = Number(row.needed_players) || 4;
      const myTeam = userTeamFromRank(Number(row.rnk), neededPlayers);
      const winnerTeam = String(row.winner_team || '').toUpperCase().trim();
      const score = String(row.score || '');

      let outcome: MatchOutcome = 'draw';
      if (winnerTeam === 'A' || winnerTeam === 'B') {
        outcome = myTeam === winnerTeam ? 'win' : 'loss';
      } else {
        const pts = parseScore(score);
        if (pts && pts.a !== pts.b) {
          const scoreWinner = pts.a > pts.b ? 'A' : 'B';
          outcome = myTeam === scoreWinner ? 'win' : 'loss';
        }
      }

      outcomes.push(outcome);
      if (outcome === 'win') wins += 1;

      const mode = String(row.mode || 'friendly');
      if (mode === 'competitive') competitiveMatches += 1;

      const clubId = row.club_id as string | null;
      if (clubId) {
        clubCounts.set(clubId, (clubCounts.get(clubId) ?? 0) + 1);
      }
    }

    return {
      userId,
      completedMatches: historyRes.rows.length,
      wins,
      currentWinStreak: computeWinStreak(outcomes),
      competitiveMatches,
      maxMatchesAtSingleClub: clubCounts.size ? Math.max(...clubCounts.values()) : 0,
      justFinished,
    };
  }

  private async awardEligibleBadges(
    userId: string,
    ctx: PlayerBadgeContext,
  ): Promise<BadgeCode[]> {
    const eligible = evaluateEligibleBadges(ctx);
    if (eligible.length === 0) return [];

    const badgeRows = await this.db.query(`SELECT id, code FROM badges WHERE code = ANY($1)`, [
      eligible,
    ]);
    const newlyEarned: BadgeCode[] = [];

    for (const badge of badgeRows.rows) {
      const insert = await this.db.query(
        `INSERT INTO user_badges (user_id, badge_id, match_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, badge_id) DO NOTHING
         RETURNING id`,
        [userId, badge.id, ctx.justFinished.matchId],
      );

      if (insert.rows[0]) {
        newlyEarned.push(badge.code as BadgeCode);
        await this.notifyBadgeEarned(userId, badge.code, ctx.justFinished.matchId);
      }
    }

    if (newlyEarned.length) {
      this.logger.log(`User ${userId} earned badges: ${newlyEarned.join(', ')}`);
    }

    return newlyEarned;
  }

  private async notifyBadgeEarned(userId: string, code: string, matchId: string) {
    const badgeRes = await this.db.query(`SELECT name FROM badges WHERE code = $1`, [code]);
    const name = badgeRes.rows[0]?.name ?? 'Nueva insignia';
    await this.db.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'badge_earned', $2, $3, $4::jsonb)`,
      [
        userId,
        '¡Nueva insignia!',
        `Desbloqueaste "${name}".`,
        JSON.stringify({ badgeCode: code, matchId }),
      ],
    );
  }

  private parseSets(raw: unknown): SetScore[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.filter(
        (set) =>
          set &&
          typeof set === 'object' &&
          typeof (set as SetScore).teamA === 'number' &&
          typeof (set as SetScore).teamB === 'number',
      ) as SetScore[];
    }
    if (typeof raw === 'string') {
      try {
        return this.parseSets(JSON.parse(raw));
      } catch {
        return [];
      }
    }
    return [];
  }
}
