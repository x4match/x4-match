import { Injectable } from '@nestjs/common';
import {
  COMPETITIVE_BASE_POINTS,
  type CompetitiveMatchOutcome,
  computeCompetitiveMatchPoints,
} from '../common/utils/category-scoring.util';
import { getCategoryRatingRange, getLevelCategory, getMonthKey, resolveVisibleLevelCategory } from '../common/utils';
import { resolvePlayerRating, ratingToSkillScore } from '../common/utils/player-rating.util';
import { DatabaseService } from '../database/database.service';
import { applyNoveltyToCompetitivePoints, splitParticipantsByTeam } from '../rating/engine';
import { countRecentTeamMatchups } from '../rating/matchup-history';

type MatchParticipant = {
  userId: string;
  level: number | null;
  rating: number | null;
  rnk: number;
  categoryStatus: string;
};

function userTeamFromRank(rnk: number, neededPlayers: number): 'A' | 'B' {
  const half = Math.ceil(Math.max(neededPlayers, 2) / 2);
  return rnk <= half ? 'A' : 'B';
}

function parseScore(score: string): { a: number; b: number } | null {
  const parts = score.split(/[-:]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { a: parts[0], b: parts[1] };
  }
  return null;
}

function matchOutcomeForPlayer(
  myTeam: 'A' | 'B',
  winnerTeam: string | null,
  score: string | null,
): CompetitiveMatchOutcome {
  const pts = score ? parseScore(score) : null;
  if (pts && pts.a === pts.b) return 'draw';
  const w = String(winnerTeam || '')
    .toUpperCase()
    .trim();
  if (w !== 'A' && w !== 'B') return 'draw';
  return myTeam === w ? 'win' : 'loss';
}

@Injectable()
export class CompetitiveScoringService {
  constructor(private readonly db: DatabaseService) {}

  async awardForFinishedMatch(matchId: string) {
    const matchRes = await this.db.query(
      `SELECT m.id, m.mode, m.tournament_id, m.date, m.needed_players,
              mr.winner_team, mr.score
       FROM matches m
       LEFT JOIN match_results mr ON mr.match_id = m.id
       WHERE m.id = $1`,
      [matchId],
    );
    const match = matchRes.rows[0];
    if (!match) return;
    if (match.tournament_id) return;
    if (match.mode !== 'competitive') return;

    const already = await this.db.query(
      `SELECT 1 FROM player_competitive_points_ledger WHERE match_id = $1 LIMIT 1`,
      [matchId],
    );
    if (already.rows[0]) return;

    const playersRes = await this.db.query(
      `SELECT p.user_id, p.level, p.rating, p.category_status,
              ROW_NUMBER() OVER (ORDER BY mp.created_at) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );

    const participants: MatchParticipant[] = playersRes.rows.map((row) => ({
      userId: row.user_id,
      level: row.level != null ? Number(row.level) : null,
      rating: row.rating != null ? Number(row.rating) : null,
      rnk: Number(row.rnk),
      categoryStatus: (row.category_status as string) ?? 'confirmed',
    }));

    if (participants.length < 2) return;

    const neededPlayers = Number(match.needed_players) || 4;
    const monthKey = getMonthKey(new Date(match.date));
    const { teamA, teamB } = splitParticipantsByTeam(
      participants.map((player) => ({ userId: player.userId, rank: player.rnk })),
      neededPlayers,
    );
    const priorEncounters =
      teamA.length > 0 && teamB.length > 0
        ? await countRecentTeamMatchups(
            this.db,
            matchId,
            teamA.map((player) => player.userId),
            teamB.map((player) => player.userId),
          )
        : 0;

    for (const player of participants) {
      if (player.categoryStatus === 'provisional') continue;
      const myTeam = userTeamFromRank(player.rnk, neededPlayers);
      const playerRating = resolvePlayerRating({ rating: player.rating, level: player.level });
      const mySkill = ratingToSkillScore(playerRating);
      const myCategory = getLevelCategory(playerRating);

      const opponents = participants
        .filter((p) => p.userId !== player.userId)
        .filter((p) => userTeamFromRank(p.rnk, neededPlayers) !== myTeam);

      const opponentSkills = opponents.map((o) =>
        ratingToSkillScore(resolvePlayerRating({ rating: o.rating, level: o.level })),
      );
      const opponentCategories = opponents.map((o) =>
        getLevelCategory(resolvePlayerRating({ rating: o.rating, level: o.level })),
      );

      const outcome = matchOutcomeForPlayer(
        myTeam,
        match.winner_team,
        match.score,
      );
      const points = applyNoveltyToCompetitivePoints(
        computeCompetitiveMatchPoints(mySkill, opponentSkills, outcome),
        priorEncounters,
      );

      const ledgerInsert = await this.db.query(
        `INSERT INTO player_competitive_points_ledger (
           user_id, match_id, month_key, points, base_points, my_category, opponent_categories
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, match_id) DO NOTHING
         RETURNING id`,
        [
          player.userId,
          matchId,
          monthKey,
          points,
          COMPETITIVE_BASE_POINTS,
          myCategory,
          opponentCategories,
        ],
      );

      if (!ledgerInsert.rows[0]) continue;

      await this.db.query(
        `INSERT INTO player_competitive_monthly_points (user_id, month_key, points, matches_played, updated_at)
         VALUES ($1, $2, $3, 1, NOW())
         ON CONFLICT (user_id, month_key)
         DO UPDATE SET
           points = player_competitive_monthly_points.points + EXCLUDED.points,
           matches_played = player_competitive_monthly_points.matches_played + 1,
           updated_at = NOW()`,
        [player.userId, monthKey, points],
      );
    }
  }

  async getMyMonthlyPoints(userId: string, monthKey?: string) {
    const key = monthKey ?? getMonthKey();
    const result = await this.db.query(
      `SELECT points, matches_played, month_key
       FROM player_competitive_monthly_points
       WHERE user_id = $1 AND month_key = $2`,
      [userId, key],
    );
    const row = result.rows[0];
    const levelRes = await this.db.query(
      `SELECT level, rating, category_status, extras FROM players WHERE user_id = $1`,
      [userId],
    );
    const playerRow = levelRes.rows[0] ?? {};
    const extras =
      playerRow.extras && typeof playerRow.extras === 'object' && !Array.isArray(playerRow.extras)
        ? playerRow.extras
        : {};
    const rating = resolvePlayerRating(playerRow);
    const category = resolveVisibleLevelCategory({
      rating,
      categoryStatus: playerRow.category_status,
      declaredCategory: typeof extras.declaredCategory === 'string' ? extras.declaredCategory : null,
    });

    return {
      monthKey: key,
      points: row?.points ?? 0,
      matchesPlayed: row?.matches_played ?? 0,
      levelCategory: category,
    };
  }

  async getMonthlyLeaderboard(
    monthKey?: string,
    category?: string,
    gender?: string,
    limit = 50,
  ) {
    const key = monthKey ?? getMonthKey();
    const categoryRange = category ? getCategoryRatingRange(category) : null;
    const genderFilter = this.normalizeGenderFilter(gender);

    const params: Array<string | number> = [key];
    const conditions = ['pcm.month_key = $1'];

    if (categoryRange) {
      const minParam = params.length + 1;
      params.push(categoryRange.min);
      const maxParam = params.length + 1;
      params.push(categoryRange.max);
      const ratingExpr = `CASE
        WHEN p.rating IS NOT NULL THEN ROUND(p.rating::numeric)
        ELSE ROUND(1000 + (COALESCE(p.level, 2.5) - 2.5) * 80)
      END`;
      conditions.push(`${ratingExpr} >= $${minParam}`);
      conditions.push(`${ratingExpr} <= $${maxParam}`);
    }

    if (genderFilter) {
      params.push(genderFilter);
      conditions.push(`COALESCE(p.extras->>'gender', '') = $${params.length}`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const result = await this.db.query(
      `SELECT u.id AS user_id, u.name, p.photo_url, p.level, p.rating,
              pcm.points, pcm.matches_played
       FROM player_competitive_monthly_points pcm
       INNER JOIN users u ON u.id = pcm.user_id
       INNER JOIN players p ON p.user_id = u.id
       WHERE ${conditions.join(' AND ')}
         AND p.category_status = 'confirmed'
       ORDER BY pcm.points DESC, pcm.matches_played DESC
       LIMIT ${limitParam}`,
      params,
    );

    const entries = result.rows.map((row, index) => {
      const rating = resolvePlayerRating({ rating: row.rating, level: row.level });
      const levelCategory = getLevelCategory(rating);
      return {
        position: index + 1,
        userId: row.user_id,
        name: row.name,
        photo: row.photo_url,
        level: row.level != null ? Number(row.level) : null,
        rating,
        levelCategory,
        points: row.points,
        matchesPlayed: row.matches_played,
      };
    });

    return {
      monthKey: key,
      category: category ?? null,
      gender: genderFilter ?? null,
      entries,
    };
  }

  private normalizeGenderFilter(gender?: string): string | null {
    const value = gender?.trim().toLowerCase();
    if (!value || value === 'mixed' || value === 'mixto') return null;
    if (value === 'male' || value === 'masculino' || value === 'hombre') return 'Masculino';
    if (value === 'female' || value === 'femenino' || value === 'mujer') return 'Femenino';
    return null;
  }
}
