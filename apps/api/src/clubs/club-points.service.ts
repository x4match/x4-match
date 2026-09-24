import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  applyPointsMultiplier,
  getMatchScheduleContext,
  getPromotionMultiplier,
} from '../common/utils';
import { DatabaseService } from '../database/database.service';
import { userTeamFromRank } from '../common/utils/match-result.util';

export const POINTS_MATCH_PLAYED = 10;
export const POINTS_MATCH_WON = 15;

export interface MatchPointsBreakdown {
  basePoints: number;
  multiplier: number;
  totalPoints: number;
  inPromotion: boolean;
  /** Bonus flat de la promo (solo canjeable; no ranking). */
  promoBonusPoints: number;
  monthKey: string;
}

@Injectable()
export class ClubPointsService {
  constructor(private readonly db: DatabaseService) {}

  async awardForFinishedMatch(matchId: string, winnerTeam?: string) {
    const matchResult = await this.db.query(
      `SELECT m.id, m.club_id, m.date FROM matches m WHERE m.id = $1 AND m.club_id IS NOT NULL`,
      [matchId],
    );
    const match = matchResult.rows[0];
    if (!match) return;

    const matchDate = new Date(match.date);
    const breakdown = await this.resolveMatchPoints(match.club_id, matchDate, POINTS_MATCH_PLAYED);

    const matchMeta = await this.db.query(
      `SELECT needed_players FROM matches WHERE id = $1`,
      [matchId],
    );
    const neededPlayers = Number(matchMeta.rows[0]?.needed_players) || 4;

    const players = await this.db.query(
      `SELECT p.user_id,
              ROW_NUMBER() OVER (ORDER BY mp.created_at) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );

    for (const row of players.rows) {
      await this.awardMatchReason(
        match.club_id,
        row.user_id,
        matchId,
        'MATCH_PLAYED',
        breakdown,
        { countMatch: true },
      );
    }

    const normalizedWinner = String(winnerTeam || '')
      .toUpperCase()
      .trim();
    if (normalizedWinner === 'A' || normalizedWinner === 'B') {
      const winBreakdown = await this.resolveMatchPoints(match.club_id, matchDate, POINTS_MATCH_WON);
      for (const row of players.rows) {
        const team = userTeamFromRank(Number(row.rnk), neededPlayers);
        if (team !== normalizedWinner) continue;
        await this.awardMatchReason(
          match.club_id,
          row.user_id,
          matchId,
          'MATCH_WON',
          winBreakdown,
          { countMatch: false },
        );
      }
    }

    // Bonus flat de promo: solo wallet canjeable (nunca ranking ni competitivos).
    if (breakdown.promoBonusPoints > 0) {
      for (const row of players.rows) {
        await this.addPoints(
          match.club_id,
          row.user_id,
          breakdown.promoBonusPoints,
          'PROMO_BONUS',
          matchId,
          {
            monthKey: breakdown.monthKey,
            baseAmount: breakdown.promoBonusPoints,
            multiplier: 1,
            countMatch: false,
            affectMonthly: false,
          },
        );
      }
    }
  }

  /**
   * Base → wallet + ranking del club.
   * Extra por multiplicador de promo → solo wallet canjeable.
   */
  private async awardMatchReason(
    clubId: string,
    userId: string,
    matchId: string,
    reason: 'MATCH_PLAYED' | 'MATCH_WON',
    breakdown: MatchPointsBreakdown,
    opts: { countMatch: boolean },
  ) {
    await this.addPoints(clubId, userId, breakdown.basePoints, reason, matchId, {
      monthKey: breakdown.monthKey,
      baseAmount: breakdown.basePoints,
      multiplier: 1,
      countMatch: opts.countMatch,
      affectMonthly: true,
    });

    const promoExtra = breakdown.totalPoints - breakdown.basePoints;
    if (promoExtra > 0) {
      await this.addPoints(clubId, userId, promoExtra, 'PROMO_BONUS', matchId, {
        monthKey: breakdown.monthKey,
        baseAmount: breakdown.basePoints,
        multiplier: breakdown.multiplier,
        countMatch: false,
        affectMonthly: false,
      });
    }
  }

  async resolveMatchPoints(
    clubId: string,
    matchDate: Date,
    basePoints: number,
  ): Promise<MatchPointsBreakdown> {
    const schedule = getMatchScheduleContext(matchDate);
    const promotion = await this.getActivePromotion(clubId, schedule.dayOfWeek, schedule.hour);
    let multiplier = 1;

    if (promotion) {
      const planResult = await this.db.query(
        `SELECT subscription_plan FROM clubs WHERE id = $1`,
        [clubId],
      );
      multiplier = getPromotionMultiplier(planResult.rows[0]?.subscription_plan);
    }

    return {
      basePoints,
      multiplier,
      totalPoints: applyPointsMultiplier(basePoints, multiplier),
      inPromotion: Boolean(promotion),
      promoBonusPoints: Number(promotion?.bonus_points ?? 0),
      monthKey: schedule.monthKey,
    };
  }

  async isMatchInPromotion(clubId: string, dayOfWeek: number, hour: number): Promise<boolean> {
    const promo = await this.getActivePromotion(clubId, dayOfWeek, hour);
    return Boolean(promo);
  }

  private async getActivePromotion(
    clubId: string,
    dayOfWeek: number,
    hour: number,
  ): Promise<{ bonus_points: number } | null> {
    const result = await this.db.query<{ bonus_points: number }>(
      `SELECT bonus_points FROM club_promotions
       WHERE club_id = $1 AND active = TRUE
         AND start_hour <= $2 AND end_hour > $2
         AND (day_of_week IS NULL OR day_of_week = $3)
       ORDER BY bonus_points DESC
       LIMIT 1`,
      [clubId, hour, dayOfWeek],
    );
    return result.rows[0] ?? null;
  }

  async addPoints(
    clubId: string,
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string,
    meta?: {
      monthKey: string;
      baseAmount: number;
      multiplier: number;
      countMatch?: boolean;
      /** Si false, solo acredita wallet canjeable (no ranking mensual del club). Default true. */
      affectMonthly?: boolean;
    },
    client?: PoolClient,
  ) {
    if (amount <= 0) return;

    const monthKey = meta?.monthKey;
    const baseAmount = meta?.baseAmount ?? amount;
    const multiplier = meta?.multiplier ?? 1;
    const countMatch = meta?.countMatch ?? reason === 'MATCH_PLAYED';
    const affectMonthly = meta?.affectMonthly ?? true;
    const q = <T = unknown>(sql: string, params?: unknown[]) =>
      client ? client.query<T>(sql, params) : this.db.query<T>(sql, params);

    await q(
      `INSERT INTO club_points_ledger (
         club_id, user_id, amount, reason, reference_id, month_key, base_amount, multiplier
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [clubId, userId, amount, reason, referenceId ?? null, monthKey ?? null, baseAmount, multiplier],
    );

    await q(
      `INSERT INTO club_member_points (club_id, user_id, points, matches_at_club, last_played_at, updated_at)
       VALUES ($1, $2, $3,
         CASE WHEN $4 THEN 1 ELSE 0 END,
         CASE WHEN $4 THEN NOW() ELSE NULL END,
         NOW())
       ON CONFLICT (club_id, user_id)
       DO UPDATE SET
         points = club_member_points.points + EXCLUDED.points,
         matches_at_club = club_member_points.matches_at_club +
           CASE WHEN $4 THEN 1 ELSE 0 END,
         last_played_at = COALESCE(
           CASE WHEN $4 THEN NOW() ELSE NULL END,
           club_member_points.last_played_at
         ),
         updated_at = NOW()`,
      [clubId, userId, amount, countMatch],
    );

    if (monthKey && affectMonthly) {
      await q(
        `INSERT INTO club_member_monthly_points (
           club_id, user_id, month_key, points, matches_played, updated_at
         ) VALUES ($1, $2, $3, $4,
           CASE WHEN $5 THEN 1 ELSE 0 END,
           NOW())
         ON CONFLICT (club_id, user_id, month_key)
         DO UPDATE SET
           points = club_member_monthly_points.points + EXCLUDED.points,
           matches_played = club_member_monthly_points.matches_played +
             CASE WHEN $5 THEN 1 ELSE 0 END,
           updated_at = NOW()`,
        [clubId, userId, monthKey, amount, countMatch],
      );
    }
  }
}
