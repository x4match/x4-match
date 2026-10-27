import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  applyPointsMultiplier,
  getMatchScheduleContext,
  getPromotionMultiplier,
} from '../common/utils';
import { COURT_TIMEZONE } from '../common/utils/court-schedule.util';
import { DatabaseService } from '../database/database.service';
import { userTeamFromRank } from '../common/utils/match-result.util';

export const POINTS_MATCH_PLAYED = 10;
export const POINTS_MATCH_WON = 15;

/** Mínimo de jugadores con cuenta real (sin guests) para acreditar puntos de club. */
export const MIN_REAL_PLAYERS_FOR_CLUB_POINTS = 4;

/** Tope de partidos que suman puntos canjeables por usuario y día (AR). */
export const MAX_CLUB_POINT_MATCHES_PER_DAY = 4;

export interface MatchPointsBreakdown {
  basePoints: number;
  multiplier: number;
  totalPoints: number;
  inPromotion: boolean;
  /** Bonus flat de la promo (solo canjeable; no ranking). */
  promoBonusPoints: number;
  monthKey: string;
}

type EligibilitySkipReason =
  | 'NO_CLUB'
  | 'NO_BOOKED_COURT'
  | 'MATCH_NOT_STARTED'
  | 'TOO_FEW_REAL_PLAYERS';

@Injectable()
export class ClubPointsService {
  private readonly logger = new Logger(ClubPointsService.name);

  constructor(private readonly db: DatabaseService) {}

  async awardForFinishedMatch(matchId: string, winnerTeam?: string) {
    const eligibility = await this.evaluateMatchEligibility(matchId);
    if (eligibility.ok === false) {
      this.logger.log(`Sin puntos de club para match ${matchId}: ${eligibility.reason}`);
      return { awarded: false, reason: eligibility.reason };
    }

    const { clubId, matchDate, neededPlayers, players } = eligibility;
    const breakdown = await this.resolveMatchPoints(clubId, matchDate, POINTS_MATCH_PLAYED);

    for (const row of players) {
      if (await this.hasReachedDailyMatchCap(row.user_id)) {
        this.logger.log(
          `Tope diario de puntos alcanzado para user ${row.user_id} (match ${matchId})`,
        );
        continue;
      }

      await this.awardMatchReason(clubId, row.user_id, matchId, 'MATCH_PLAYED', breakdown, {
        countMatch: true,
        promoReason: 'PROMO_MULT_PLAYED',
      });
    }

    const normalizedWinner = String(winnerTeam || '')
      .toUpperCase()
      .trim();
    if (normalizedWinner === 'A' || normalizedWinner === 'B') {
      const winBreakdown = await this.resolveMatchPoints(clubId, matchDate, POINTS_MATCH_WON);
      for (const row of players) {
        const team = userTeamFromRank(Number(row.rnk), neededPlayers);
        if (team !== normalizedWinner) continue;
        await this.awardMatchReason(clubId, row.user_id, matchId, 'MATCH_WON', winBreakdown, {
          countMatch: false,
          promoReason: 'PROMO_MULT_WON',
        });
      }
    }

    // Bonus flat de promo: solo wallet canjeable (nunca ranking ni competitivos).
    if (breakdown.promoBonusPoints > 0) {
      for (const row of players) {
        await this.addPoints(
          clubId,
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

    return { awarded: true as const };
  }

  /**
   * Gates anti-farm:
   * - cancha in-app BOOKED
   * - horario del partido ya iniciado (AR)
   * - ≥4 jugadores reales (guests no cuentan)
   */
  async evaluateMatchEligibility(matchId: string): Promise<
    | {
        ok: true;
        clubId: string;
        matchDate: Date;
        neededPlayers: number;
        players: Array<{ user_id: string; rnk: number }>;
      }
    | { ok: false; reason: EligibilitySkipReason }
  > {
    const matchResult = await this.db.query<{
      id: string;
      club_id: string | null;
      date: Date | string;
      needed_players: number | null;
      court_slot_id: string | null;
      court_booking: string | null;
      slot_status: string | null;
    }>(
      `SELECT m.id, m.club_id, m.date, m.needed_players, m.court_slot_id, m.court_booking,
              cas.status AS slot_status
       FROM matches m
       LEFT JOIN court_availability_slots cas ON cas.id = m.court_slot_id
       WHERE m.id = $1`,
      [matchId],
    );
    const match = matchResult.rows[0];
    if (!match?.club_id) return { ok: false, reason: 'NO_CLUB' };

    const bookedInApp =
      match.court_booking === 'in_app' &&
      Boolean(match.court_slot_id) &&
      match.slot_status === 'BOOKED';
    if (!bookedInApp) return { ok: false, reason: 'NO_BOOKED_COURT' };

    const matchDate = new Date(match.date);
    // No acreditar partidos futuros (margeno de turnos valle “de mentira”).
    if (matchDate.getTime() > Date.now() + 15 * 60 * 1000) {
      return { ok: false, reason: 'MATCH_NOT_STARTED' };
    }

    const neededPlayers = Number(match.needed_players) || 4;
    const playersResult = await this.db.query<{ user_id: string; rnk: number }>(
      `SELECT p.user_id,
              ROW_NUMBER() OVER (ORDER BY mp.created_at) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );
    const players = playersResult.rows;
    if (players.length < MIN_REAL_PLAYERS_FOR_CLUB_POINTS) {
      return { ok: false, reason: 'TOO_FEW_REAL_PLAYERS' };
    }

    return {
      ok: true,
      clubId: match.club_id,
      matchDate,
      neededPlayers,
      players,
    };
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
    opts: { countMatch: boolean; promoReason: 'PROMO_MULT_PLAYED' | 'PROMO_MULT_WON' },
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
      await this.addPoints(clubId, userId, promoExtra, opts.promoReason, matchId, {
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

  private async hasReachedDailyMatchCap(userId: string): Promise<boolean> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM club_points_ledger
       WHERE user_id = $1
         AND reason = 'MATCH_PLAYED'
         AND (created_at AT TIME ZONE $2)::date =
             (NOW() AT TIME ZONE $2)::date`,
      [userId, COURT_TIMEZONE],
    );
    return Number(result.rows[0]?.count ?? 0) >= MAX_CLUB_POINT_MATCHES_PER_DAY;
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
    if (amount <= 0) return { inserted: false };

    const monthKey = meta?.monthKey;
    const baseAmount = meta?.baseAmount ?? amount;
    const multiplier = meta?.multiplier ?? 1;
    const countMatch = meta?.countMatch ?? reason === 'MATCH_PLAYED';
    const affectMonthly = meta?.affectMonthly ?? true;
    const q = <T = unknown>(sql: string, params?: unknown[]) =>
      client ? client.query<T>(sql, params) : this.db.query<T>(sql, params);

    const ledger = await q<{ id: string }>(
      `INSERT INTO club_points_ledger (
         club_id, user_id, amount, reason, reference_id, month_key, base_amount, multiplier
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (club_id, user_id, reason, reference_id)
         WHERE reference_id IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [clubId, userId, amount, reason, referenceId ?? null, monthKey ?? null, baseAmount, multiplier],
    );

    if (!ledger.rows[0]) {
      return { inserted: false };
    }

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

    return { inserted: true };
  }
}
