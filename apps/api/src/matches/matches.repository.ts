import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateMatchDto } from './dto/create-match.dto';
import type { ParsedBestOfThree } from '../common/utils/match-result.util';
import type { PlayerRatingDto } from './dto/player-rating.dto';
import { userTeamFromRank } from '../common/utils/match-result.util';
import { ratingToSkillScore, resolvePlayerRating, resolveVisibleLevelCategory } from '../common/utils';
import { COURT_SLOT_END_AT_SQL, MATCH_COURT_END_AT_SQL } from '../common/utils/court-schedule.util';
import { countRecentTeamMatchups as countRecentTeamMatchupsQuery } from '../rating/matchup-history';

export const RESULT_CONFIRM_HOURS = 48;

@Injectable()
export class MatchesRepository {
  constructor(private readonly db: DatabaseService) {}

  async expirePastCourtSlots(): Promise<number> {
    const result = await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'CANCELLED'
       WHERE status = 'OPEN'
         AND ${COURT_SLOT_END_AT_SQL} < NOW()
       RETURNING id`,
    );
    return result.rowCount ?? 0;
  }

  async expirePastCourtWindowMatches(): Promise<number> {
    const result = await this.db.query(
      `UPDATE matches m
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE m.status IN ('OPEN', 'FULL', 'CONFIRMED')
         AND (${MATCH_COURT_END_AT_SQL}) < NOW()
       RETURNING id`,
    );
    return result.rowCount ?? 0;
  }

  create(createdByUserId: string, dto: CreateMatchDto) {
    return this.db.query(
      `INSERT INTO matches (
        club_id, created_by_user_id, title, description, date, ends_at, zone,
        level_min, level_max, gender, mode, needed_players, court_slot_id,
        court_booking, venue_note, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'OPEN')
      RETURNING *`,
      [
        dto.clubId ?? null,
        createdByUserId,
        dto.title,
        dto.description ?? null,
        dto.date,
        dto.endsAt ?? null,
        dto.zone ?? null,
        dto.levelMin ?? null,
        dto.levelMax ?? null,
        dto.gender,
        dto.mode,
        dto.neededPlayers,
        dto.courtSlotId ?? null,
        dto.courtBooking ?? 'none',
        dto.venueNote ?? null,
      ],
    );
  }

  async bookCourtSlot(slotId: string, clubId: string) {
    await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'BOOKED'
       WHERE id = $1 AND club_id = $2 AND status = 'OPEN'`,
      [slotId, clubId],
    );
  }

  async releaseCourtSlot(slotId: string) {
    const result = await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'OPEN'
       WHERE id = $1
         AND status = 'BOOKED'
         AND ${COURT_SLOT_END_AT_SQL} > NOW()
       RETURNING id`,
      [slotId],
    );
    return result.rowCount ?? 0;
  }

  async getUserRole(userId: string): Promise<string | null> {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    return result.rows[0]?.role ?? null;
  }

  async listActiveParticipantUserIds(matchId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT p.user_id
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED', 'REQUESTED')`,
      [matchId],
    );
    return result.rows.map((row) => String(row.user_id));
  }

  async notifyUsers(
    userIds: string[],
    type: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ) {
    const unique = [...new Set(userIds.filter(Boolean))];
    for (const userId of unique) {
      await this.db.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [userId, type, title, body, JSON.stringify(data)],
      );
    }
  }

  async getById(matchId: string) {
    const result = await this.db.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);
    return result.rows[0] ?? null;
  }

  async getDetail(matchId: string) {
    const match = await this.getById(matchId);
    if (!match) return null;

    const players = await this.db.query(
      `SELECT p.id,
              p.user_id,
              u.name,
              p.level,
              p.rating,
              p.photo_url,
              p.extras,
              p.category_status,
              mp.status AS player_status,
              mp.slot_order
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')
       ORDER BY COALESCE(mp.slot_order, 999), mp.created_at ASC`,
      [matchId],
    );

    const guests = await this.db.query(
      `SELECT id, name, role, slot_order, sponsor_user_id
       FROM match_guests
       WHERE match_id = $1
       ORDER BY slot_order ASC, created_at ASC`,
      [matchId],
    );

    let club = null;
    if (match.club_id) {
      const clubResult = await this.db.query(
        `SELECT id, name, city, zone, address FROM clubs WHERE id = $1`,
        [match.club_id],
      );
      club = clubResult.rows[0] ?? null;
    }

    const resultRow = await this.db.query(
      `SELECT mr.score,
              mr.winner_team,
              mr.sets,
              mr.result_status,
              mr.created_by_user_id,
              mr.confirmed,
              mr.proposed_at,
              mr.confirm_deadline_at,
              mr.auto_finalized,
              u.name AS submitted_by_name
       FROM match_results mr
       LEFT JOIN users u ON u.id = mr.created_by_user_id
       WHERE mr.match_id = $1`,
      [matchId],
    );

    let confirmations: { userId: string; name: string; confirmedAt: string }[] = [];
    if (resultRow.rows[0]) {
      const confRes = await this.db.query(
        `SELECT mrc.user_id, u.name, mrc.created_at
         FROM match_result_confirmations mrc
         INNER JOIN users u ON u.id = mrc.user_id
         WHERE mrc.match_id = $1
         ORDER BY mrc.created_at ASC`,
        [matchId],
      );
      confirmations = confRes.rows.map((c) => ({
        userId: c.user_id,
        name: c.name,
        confirmedAt: c.created_at,
      }));
    }

    let rejections: { userId: string; name: string; comment?: string; rejectedAt: string }[] = [];
    if (resultRow.rows[0]) {
      const rejRes = await this.db.query(
        `SELECT mrr.user_id, u.name, mrr.comment, mrr.created_at
         FROM match_result_rejections mrr
         INNER JOIN users u ON u.id = mrr.user_id
         WHERE mrr.match_id = $1
         ORDER BY mrr.created_at ASC`,
        [matchId],
      );
      rejections = rejRes.rows.map((r) => ({
        userId: r.user_id,
        name: r.name,
        comment: r.comment ?? undefined,
        rejectedAt: r.created_at,
      }));
    }

    const joinedCount = players.rows.length + guests.rows.length;

    let courtSlot: {
      court_label: string;
      start_hour: number;
      end_hour: number;
      bonus_points: number;
      price_per_hour: number;
    } | null = null;
    if (match.court_slot_id) {
      const slotResult = await this.db.query(
        `SELECT court_label, start_hour, end_hour, bonus_points, price_per_hour
         FROM court_availability_slots
         WHERE id = $1`,
        [match.court_slot_id],
      );
      courtSlot = slotResult.rows[0] ?? null;
    }

    let clubPricing: { court_price_per_hour: number; deposit_percent: number } | null = null;
    if (match.club_id) {
      const pricingResult = await this.db.query(
        `SELECT court_price_per_hour, deposit_percent FROM clubs WHERE id = $1`,
        [match.club_id],
      );
      clubPricing = pricingResult.rows[0] ?? null;
    }

    const neededPlayers = Number(match.needed_players) || 4;
    let durationMinutes = 90;
    if (courtSlot) {
      durationMinutes = Math.max(
        30,
        (Number(courtSlot.end_hour) - Number(courtSlot.start_hour)) * 60,
      );
    } else if (match.ends_at && match.date) {
      const diffMs = new Date(match.ends_at).getTime() - new Date(match.date).getTime();
      if (diffMs > 0) durationMinutes = Math.round(diffMs / 60000);
    }

    const pricePerHour = Number(courtSlot?.price_per_hour ?? clubPricing?.court_price_per_hour ?? 0);
    const durationHours = durationMinutes / 60;
    const totalCourt = pricePerHour * durationHours;
    const pricePerPlayer =
      neededPlayers > 0 && totalCourt > 0
        ? Math.round((totalCourt / neededPlayers) * 100) / 100
        : 0;
    const depositPercent = Number(clubPricing?.deposit_percent ?? 25);
    const depositPerPlayer =
      pricePerPlayer > 0
        ? Math.round(((pricePerPlayer * depositPercent) / 100) * 100) / 100
        : 0;
    const bonusPoints = Number(courtSlot?.bonus_points ?? 0);

    const courtInfo = {
      label: courtSlot?.court_label ?? null,
      duration_minutes: durationMinutes,
      cancel_policy: '30 min para cancelar gratis',
    };

    const pricing =
      pricePerPlayer > 0 || depositPerPlayer > 0 || bonusPoints > 0
        ? {
            price_per_player: pricePerPlayer,
            deposit_amount: depositPerPlayer,
            currency: 'ARS',
            bonus_points: bonusPoints,
          }
        : null;

    const row = resultRow.rows[0];
    const disputedAt = match.disputed_at ?? null;
    const rivalReviewDeadline = match.rival_review_deadline_at ?? null;
    const now = Date.now();
    const canSubmitRivalReviews =
      match.status === 'DISPUTED' &&
      disputedAt != null &&
      rivalReviewDeadline != null &&
      new Date(rivalReviewDeadline).getTime() > now;

    return {
      ...match,
      disputed_at: disputedAt,
      rival_review_deadline_at: rivalReviewDeadline,
      can_submit_rival_reviews: canSubmitRivalReviews,
      club,
      court_info: courtInfo,
      pricing,
      joined_count: joinedCount,
      needed_players: match.needed_players,
      players: players.rows.map((p) => {
        const extras =
          p.extras && typeof p.extras === 'object' && !Array.isArray(p.extras) ? p.extras : {};
        const rating = resolvePlayerRating(p);
        const declaredCategory =
          typeof extras.declaredCategory === 'string' ? extras.declaredCategory : undefined;
        return {
          id: p.user_id,
          playerId: p.id,
          name: p.name,
          level: p.level != null ? Number(p.level) : null,
          rating,
          skillScore: ratingToSkillScore(rating),
          levelCategory: resolveVisibleLevelCategory({
            rating,
            categoryStatus: p.category_status,
            declaredCategory,
          }),
          declaredCategory,
          categoryStatus: p.category_status ?? undefined,
          photo: p.photo_url,
          status: p.player_status,
          slotOrder: p.slot_order != null ? Number(p.slot_order) : undefined,
        };
      }),
      guest_invites: guests.rows.map((guest) => ({
        id: guest.id,
        name: guest.name,
        role: guest.role,
        slotOrder: Number(guest.slot_order),
        sponsorUserId: guest.sponsor_user_id,
      })),
      result: row
        ? {
            score: row.score,
            winnerTeam: row.winner_team,
            sets: row.sets ?? [],
            status: row.result_status ?? (row.confirmed ? 'confirmed' : 'pending'),
            disputed: row.result_status === 'disputed',
            submittedByUserId: row.created_by_user_id,
            submittedByName: row.submitted_by_name,
            confirmations,
            rejections,
            requiredConfirmations: players.rows.length,
            confirmed:
              row.result_status === 'confirmed' || row.confirmed === true,
            proposedAt: row.proposed_at,
            confirmDeadlineAt: row.confirm_deadline_at,
            autoFinalized: row.auto_finalized === true,
          }
        : undefined,
    };
  }

  async listOpen() {
    const result = await this.db.query(
      `SELECT m.*,
        (
          (SELECT COUNT(*)::int FROM match_players mp WHERE mp.match_id = m.id AND mp.status IN ('JOINED','CONFIRMED'))
          +
          (SELECT COUNT(*)::int FROM match_guests mg WHERE mg.match_id = m.id)
        ) AS joined_count
       FROM matches m
       WHERE m.status IN ('OPEN', 'FULL', 'CONFIRMED')
       ORDER BY m.date ASC`,
    );
    return result.rows;
  }

  async listOpenForSearch(params: {
    categoryMin: number;
    categoryMax: number;
    lat?: number | null;
    lng?: number | null;
    radiusKm?: number | null;
    zone?: string | null;
    limit?: number;
  }) {
    const hasCoords = params.lat != null && params.lng != null;
    const radiusKm = params.radiusKm ?? 30;
    const zoneFilter = params.zone?.trim() ? `%${params.zone.trim()}%` : null;
    const limit = params.limit ?? 50;

    const distanceExpr = hasCoords
      ? `CASE
           WHEN match_lat IS NOT NULL AND match_lng IS NOT NULL THEN
             ROUND(
               (
                 6371 * acos(
                   LEAST(
                     1,
                     GREATEST(
                       -1,
                       cos(radians($3::float8)) * cos(radians(match_lat))
                       * cos(radians(match_lng) - radians($4::float8))
                       + sin(radians($3::float8)) * sin(radians(match_lat))
                     )
                   )
                 )
               )::numeric,
               1
             )
           ELSE NULL
         END`
      : 'NULL::numeric';

    const result = await this.db.query(
      `WITH match_points AS (
         SELECT m.*,
                c.id AS club_id_joined,
                c.name AS club_name,
                c.zone AS club_zone,
                c.city AS club_city,
                COALESCE(c.latitude::float8, creator.latitude::float8) AS match_lat,
                COALESCE(c.longitude::float8, creator.longitude::float8) AS match_lng,
                (
                  (SELECT COUNT(*)::int FROM match_players mp WHERE mp.match_id = m.id AND mp.status IN ('JOINED','CONFIRMED'))
                  +
                  (SELECT COUNT(*)::int FROM match_guests mg WHERE mg.match_id = m.id)
                ) AS joined_count
         FROM matches m
         LEFT JOIN clubs c ON c.id = m.club_id
         LEFT JOIN players creator ON creator.user_id = m.created_by_user_id
         WHERE m.status = 'OPEN'
           AND m.date > NOW()
           AND COALESCE(m.level_min, 0) <= $2
           AND COALESCE(m.level_max, 1000) >= $1
       )
       SELECT mp.*,
              ${distanceExpr} AS distance_km
       FROM match_points mp
       WHERE (
               SELECT COUNT(*)::int FROM match_players x WHERE x.match_id = mp.id AND x.status IN ('JOINED','CONFIRMED')
             ) + (
               SELECT COUNT(*)::int FROM match_guests g WHERE g.match_id = mp.id
             ) < mp.needed_players
         AND (
           $5::text IS NULL
           OR mp.zone ILIKE $5
           OR mp.venue_note ILIKE $5
           OR mp.club_zone ILIKE $5
           OR mp.club_city ILIKE $5
         )
         AND (
           $6::boolean = false
           OR mp.match_lat IS NULL
           OR mp.match_lng IS NULL
           OR (
             (
               6371 * acos(
                 LEAST(
                   1,
                   GREATEST(
                     -1,
                     cos(radians($3::float8)) * cos(radians(mp.match_lat))
                     * cos(radians(mp.match_lng) - radians($4::float8))
                     + sin(radians($3::float8)) * sin(radians(mp.match_lat))
                   )
                 )
               )
             ) <= $7
           )
         )
       ORDER BY distance_km ASC NULLS LAST, mp.date ASC
       LIMIT $8`,
      [
        params.categoryMin,
        params.categoryMax,
        hasCoords ? params.lat : null,
        hasCoords ? params.lng : null,
        zoneFilter,
        hasCoords,
        radiusKm,
        limit,
      ],
    );
    return result.rows;
  }

  async listByUser(userId: string) {
    const result = await this.db.query(
      `SELECT m.*,
        (
          (SELECT COUNT(*)::int FROM match_players mp2 WHERE mp2.match_id = m.id AND mp2.status IN ('JOINED','CONFIRMED'))
          +
          (SELECT COUNT(*)::int FROM match_guests mg WHERE mg.match_id = m.id)
        ) AS joined_count
       FROM matches m
       INNER JOIN players p ON p.user_id = $1
       INNER JOIN match_players mp ON mp.player_id = p.id AND mp.match_id = m.id
       WHERE mp.status IN ('JOINED', 'CONFIRMED', 'REQUESTED')
       ORDER BY m.date ASC`,
      [userId],
    );
    return result.rows;
  }

  async getPlayerIdByUserId(userId: string) {
    const result = await this.db.query(`SELECT id FROM players WHERE user_id = $1`, [userId]);
    return result.rows[0]?.id ?? null;
  }

  async getGenderByUserId(userId: string): Promise<string | null> {
    const result = await this.db.query(`SELECT extras FROM players WHERE user_id = $1`, [userId]);
    const extras = result.rows[0]?.extras;
    if (extras && typeof extras === 'object' && !Array.isArray(extras) && typeof extras.gender === 'string') {
      return extras.gender;
    }
    return null;
  }

  async getPlayerSkillScoreByUserId(userId: string) {
    const result = await this.db.query(`SELECT level, rating FROM players WHERE user_id = $1`, [userId]);
    if (!result.rows[0]) return null;
    return ratingToSkillScore(resolvePlayerRating(result.rows[0]));
  }

  async getPlayerPlacementBandByUserId(userId: string) {
    const result = await this.db.query(
      `SELECT level, rating, category_status, extras
       FROM players
       WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const extras =
      row.extras && typeof row.extras === 'object' && !Array.isArray(row.extras) ? row.extras : {};
    const rating = resolvePlayerRating(row);
    return {
      rating,
      skillScore: ratingToSkillScore(rating),
      categoryStatus: (row.category_status as string) ?? 'confirmed',
      declaredCategory:
        typeof extras.declaredCategory === 'string' ? extras.declaredCategory : null,
    };
  }

  async getPlayerCoordinatesByUserId(userId: string): Promise<{ lat: number | null; lng: number | null }> {
    const result = await this.db.query(
      `SELECT latitude, longitude FROM players WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    const lat = row?.latitude != null ? Number(row.latitude) : null;
    const lng = row?.longitude != null ? Number(row.longitude) : null;
    return {
      lat: lat != null && Number.isFinite(lat) ? lat : null,
      lng: lng != null && Number.isFinite(lng) ? lng : null,
    };
  }

  async savePlayerCoordinates(userId: string, lat: number, lng: number) {
    await this.db.query(
      `UPDATE players
       SET latitude = $2,
           longitude = $3,
           location_updated_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, lat, lng],
    );
  }

  async join(
    matchId: string,
    playerId: string,
    status: 'JOINED' | 'CONFIRMED' | 'REQUESTED' = 'JOINED',
    slotOrder?: number | null,
  ) {
    await this.db.query(
      `INSERT INTO match_players (match_id, player_id, status, slot_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id, player_id)
       DO UPDATE SET status = EXCLUDED.status,
                     slot_order = CASE
                       WHEN EXCLUDED.status = 'REQUESTED' THEN NULL
                       ELSE COALESCE(EXCLUDED.slot_order, match_players.slot_order)
                     END`,
      [matchId, playerId, status, slotOrder ?? null],
    );
  }

  async getPlayerMatchStatus(matchId: string, playerId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT status FROM match_players WHERE match_id = $1 AND player_id = $2`,
      [matchId, playerId],
    );
    return result.rows[0]?.status ?? null;
  }

  async listJoinRequests(matchId: string) {
    const result = await this.db.query(
      `SELECT p.id AS player_id,
              p.user_id,
              u.name,
              p.level,
              p.rating,
              p.photo_url,
              mp.created_at AS requested_at
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE mp.match_id = $1 AND mp.status = 'REQUESTED'
       ORDER BY mp.created_at ASC`,
      [matchId],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      playerId: row.player_id,
      name: row.name,
      level: row.level != null ? Number(row.level) : null,
      rating: row.rating != null ? Number(row.rating) : null,
      skillScore: ratingToSkillScore(resolvePlayerRating(row)),
      photo: row.photo_url,
      requestedAt: row.requested_at,
    }));
  }

  async addGuestInvite(input: {
    matchId: string;
    name: string;
    role: 'partner' | 'opponent';
    slotOrder: number;
    invitedByUserId: string;
    sponsorUserId: string;
  }) {
    const result = await this.db.query(
      `INSERT INTO match_guests (match_id, name, role, slot_order, invited_by_user_id, sponsor_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.matchId,
        input.name,
        input.role,
        input.slotOrder,
        input.invitedByUserId,
        input.sponsorUserId,
      ],
    );
    return result.rows[0];
  }

  async listGuestInvites(matchId: string) {
    const result = await this.db.query(
      `SELECT * FROM match_guests WHERE match_id = $1 ORDER BY slot_order ASC, created_at ASC`,
      [matchId],
    );
    return result.rows;
  }

  async countGuestInvites(matchId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM match_guests WHERE match_id = $1`,
      [matchId],
    );
    return result.rows[0].count as number;
  }

  async getTakenSlotOrders(matchId: string): Promise<number[]> {
    const result = await this.db.query(
      `SELECT slot_order
       FROM match_players
       WHERE match_id = $1 AND status IN ('JOINED', 'CONFIRMED') AND slot_order IS NOT NULL
       UNION
       SELECT slot_order
       FROM match_guests
       WHERE match_id = $1
       ORDER BY slot_order ASC`,
      [matchId],
    );
    return result.rows.map((row) => Number(row.slot_order));
  }

  async getNextAvailableSlotOrder(matchId: string): Promise<number | null> {
    const match = await this.getById(matchId);
    if (!match) return null;
    const taken = new Set(await this.getTakenSlotOrders(matchId));
    const totalSlots = Number(match.needed_players) || 4;
    for (let slot = 1; slot <= totalSlots; slot += 1) {
      if (!taken.has(slot)) return slot;
    }
    return null;
  }

  async confirmPlayer(matchId: string, playerId: string) {
    await this.db.query(
      `UPDATE match_players SET status = 'CONFIRMED'
       WHERE match_id = $1 AND player_id = $2 AND status IN ('JOINED', 'CONFIRMED')`,
      [matchId, playerId],
    );
  }

  async leave(matchId: string, playerId: string) {
    await this.db.query(
      `UPDATE match_players SET status = 'LEFT' WHERE match_id = $1 AND player_id = $2`,
      [matchId, playerId],
    );
  }

  async updateCreatedBy(matchId: string, userId: string) {
    await this.db.query(
      `UPDATE matches SET created_by_user_id = $2, updated_at = NOW() WHERE id = $1`,
      [matchId, userId],
    );
  }

  async getNextOrganizerCandidate(matchId: string, excludeUserId: string) {
    const result = await this.db.query(
      `SELECT p.user_id, u.name
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE mp.match_id = $1
         AND mp.status IN ('JOINED', 'CONFIRMED')
         AND p.user_id <> $2
       ORDER BY COALESCE(mp.slot_order, 999), mp.created_at ASC
       LIMIT 1`,
      [matchId, excludeUserId],
    );
    return (result.rows[0] as { user_id: string; name: string } | undefined) ?? null;
  }

  async countJoinedPlayers(matchId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count
       FROM match_players
       WHERE match_id = $1 AND status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );
    const guestCount = await this.countGuestInvites(matchId);
    return (result.rows[0].count as number) + guestCount;
  }

  async countConfirmedPlayers(matchId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM match_players WHERE match_id = $1 AND status = 'CONFIRMED'`,
      [matchId],
    );
    const guestCount = await this.countGuestInvites(matchId);
    return (result.rows[0].count as number) + guestCount;
  }

  updateStatus(matchId: string, status: string) {
    return this.db.query(
      `UPDATE matches SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [matchId, status],
    );
  }

  async createMatchChatIfMissing(matchId: string) {
    await this.db.query(
      `INSERT INTO chats (match_id, type) VALUES ($1, 'MATCH') ON CONFLICT (match_id) DO NOTHING`,
      [matchId],
    );
  }

  async getParticipantUserIds(matchId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT p.user_id
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );
    return result.rows.map((r) => r.user_id as string);
  }

  async getParticipantsForRating(matchId: string) {
    const result = await this.db.query(
      `SELECT p.user_id,
              p.level,
              p.rating,
              p.category_status,
              COALESCE(mp.slot_order, ROW_NUMBER() OVER (ORDER BY mp.created_at)) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')
       ORDER BY COALESCE(mp.slot_order, 999), mp.created_at ASC`,
      [matchId],
    );
    return result.rows.map((row) => ({
      userId: row.user_id as string,
      level: row.level != null ? Number(row.level) : null,
      rating: row.rating != null ? Number(row.rating) : null,
      categoryStatus: (row.category_status as string) ?? 'confirmed',
      rank: Number(row.rnk),
    }));
  }

  async advancePlacementForCompetitiveMatch(userIds: string[], matchesRequired: number) {
    if (userIds.length === 0) return;
    await this.db.query(
      `UPDATE players
       SET placement_matches_played = placement_matches_played + 1,
           category_status = CASE
             WHEN placement_matches_played + 1 >= $1 THEN 'confirmed'
             ELSE category_status
           END,
           updated_at = NOW()
       WHERE user_id = ANY($2::uuid[])
         AND category_status = 'provisional'`,
      [matchesRequired, userIds],
    );
  }

  async proposeResult(matchId: string, userId: string, parsed: ParsedBestOfThree) {
    await this.db.query(`DELETE FROM match_result_confirmations WHERE match_id = $1`, [matchId]);
    await this.db.query(`DELETE FROM match_result_rejections WHERE match_id = $1`, [matchId]);

    return this.db.query(
      `INSERT INTO match_results (
         match_id, winner_team, score, sets, created_by_user_id, confirmed, result_status,
         proposed_at, confirm_deadline_at, auto_finalized
       ) VALUES (
         $1, $2, $3, $4::jsonb, $5, false, 'pending',
         NOW(), NOW() + ($6::text || ' hours')::interval, false
       )
       ON CONFLICT (match_id)
       DO UPDATE SET
         winner_team = EXCLUDED.winner_team,
         score = EXCLUDED.score,
         sets = EXCLUDED.sets,
         created_by_user_id = EXCLUDED.created_by_user_id,
         confirmed = false,
         result_status = 'pending',
         proposed_at = NOW(),
         confirm_deadline_at = NOW() + ($6::text || ' hours')::interval,
         auto_finalized = false,
         created_at = NOW()
       RETURNING *`,
      [
        matchId,
        parsed.winnerTeam,
        parsed.scoreSummary,
        JSON.stringify(parsed.sets),
        userId,
        String(RESULT_CONFIRM_HOURS),
      ],
    );
  }

  async addResultConfirmation(matchId: string, userId: string) {
    await this.db.query(
      `INSERT INTO match_result_confirmations (match_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (match_id, user_id) DO NOTHING`,
      [matchId, userId],
    );
  }

  async countResultConfirmations(matchId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM match_result_confirmations WHERE match_id = $1`,
      [matchId],
    );
    return result.rows[0].count as number;
  }

  async finalizeResult(matchId: string, autoFinalized = false) {
    return this.db.query(
      `UPDATE match_results
       SET result_status = 'confirmed', confirmed = true, auto_finalized = $2
       WHERE match_id = $1
       RETURNING *`,
      [matchId, autoFinalized],
    );
  }

  async closeAsDisputedWithoutPoints(matchId: string) {
    await this.db.query(
      `UPDATE match_results
       SET result_status = 'disputed',
           confirmed = false,
           auto_finalized = true,
           score = CASE
             WHEN COALESCE(score, '') LIKE '%Sin acuerdo%' THEN score
             ELSE TRIM(COALESCE(score, 'Sin resultado')) || ' — Sin acuerdo en 48 h'
           END
       WHERE match_id = $1`,
      [matchId],
    );
    return this.db.query(
      `UPDATE matches
       SET status = 'DISPUTED',
           disputed_at = NOW(),
           rival_review_deadline_at = NOW() + interval '48 hours',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [matchId],
    );
  }

  async getOpponentUserIds(matchId: string, userId: string): Promise<string[]> {
    const team = await this.getUserTeamInMatch(matchId, userId);
    if (!team) return [];

    const matchRow = await this.db.query(`SELECT needed_players FROM matches WHERE id = $1`, [
      matchId,
    ]);
    const neededPlayers = Number(matchRow.rows[0]?.needed_players) || 4;

    const result = await this.db.query(
      `SELECT p.user_id,
              ROW_NUMBER() OVER (ORDER BY mp.created_at) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId],
    );

    return result.rows
      .filter((row) => userTeamFromRank(Number(row.rnk), neededPlayers) !== team)
      .map((row) => row.user_id as string);
  }

  async hasUserSubmittedRivalReviews(matchId: string, userId: string): Promise<boolean> {
    const opponents = await this.getOpponentUserIds(matchId, userId);
    if (opponents.length === 0) return true;

    const result = await this.db.query(
      `SELECT COUNT(DISTINCT rated_user_id)::int AS count
       FROM match_player_ratings
       WHERE match_id = $1 AND rater_user_id = $2 AND rated_user_id = ANY($3::uuid[])`,
      [matchId, userId, opponents],
    );
    return (result.rows[0]?.count ?? 0) >= opponents.length;
  }

  async listExpiredPendingResults() {
    const result = await this.db.query(
      `SELECT mr.match_id, mr.created_by_user_id, mr.winner_team, mr.score, m.needed_players
       FROM match_results mr
       INNER JOIN matches m ON m.id = mr.match_id
       WHERE mr.result_status = 'pending'
         AND mr.confirm_deadline_at IS NOT NULL
         AND mr.confirm_deadline_at <= NOW()
         AND m.status IN ('IN_PROGRESS', 'CONFIRMED', 'FINISHED')`,
    );
    return result.rows as {
      match_id: string;
      created_by_user_id: string;
      winner_team: string;
      score: string;
      needed_players: number;
    }[];
  }

  async getUserTeamInMatch(matchId: string, userId: string): Promise<'A' | 'B' | null> {
    const result = await this.db.query(
      `SELECT m.needed_players,
              ROW_NUMBER() OVER (ORDER BY mp.created_at) AS rnk
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       INNER JOIN matches m ON m.id = mp.match_id
       WHERE mp.match_id = $1 AND p.user_id = $2 AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId, userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return userTeamFromRank(Number(row.rnk), Number(row.needed_players) || 4);
  }

  async applyAutoFinalizedWinner(matchId: string, winnerTeam: 'A' | 'B') {
    return this.db.query(
      `UPDATE match_results
       SET winner_team = $2,
           score = CASE
             WHEN score LIKE '%(plazo 48h)%' THEN score
             ELSE score || ' (plazo 48h)'
           END
       WHERE match_id = $1
       RETURNING *`,
      [matchId, winnerTeam],
    );
  }

  async savePlayerRatings(
    matchId: string,
    raterUserId: string,
    ratings: PlayerRatingDto[],
    allowedUserIds: string[],
  ) {
    const allowed = new Set(allowedUserIds);
    for (const rating of ratings) {
      if (rating.userId === raterUserId) continue;
      if (!allowed.has(rating.userId)) continue;
      await this.db.query(
        `INSERT INTO match_player_ratings (match_id, rater_user_id, rated_user_id, score, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (match_id, rater_user_id, rated_user_id)
         DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment`,
        [matchId, raterUserId, rating.userId, rating.score, rating.comment ?? null],
      );
    }
  }

  async hasRatingHistory(matchId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1
       FROM player_rating_history
       WHERE match_id = $1
       LIMIT 1`,
      [matchId],
    );
    return !!result.rows[0];
  }

  async savePlayerRatingHistory(
    matchId: string,
    changes: Array<{ userId: string; ratingBefore: number; ratingAfter: number; delta: number }>,
  ) {
    for (const change of changes) {
      await this.db.query(
        `UPDATE players
         SET rating = $2, updated_at = NOW()
         WHERE user_id = $1`,
        [change.userId, change.ratingAfter],
      );
      await this.db.query(
        `INSERT INTO player_rating_history (user_id, match_id, rating_before, rating_after, delta)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, match_id)
         DO UPDATE SET
           rating_before = EXCLUDED.rating_before,
           rating_after = EXCLUDED.rating_after,
           delta = EXCLUDED.delta`,
        [change.userId, matchId, change.ratingBefore, change.ratingAfter, change.delta],
      );
    }
  }

  countRecentTeamMatchups(
    matchId: string,
    teamAUserIds: string[],
    teamBUserIds: string[],
    windowDays?: number,
  ) {
    return countRecentTeamMatchupsQuery(this.db, matchId, teamAUserIds, teamBUserIds, windowDays);
  }

  async addResultRejection(matchId: string, userId: string, comment?: string) {
    await this.db.query(
      `INSERT INTO match_result_rejections (match_id, user_id, comment)
       VALUES ($1, $2, $3)
       ON CONFLICT (match_id, user_id)
       DO UPDATE SET comment = COALESCE(EXCLUDED.comment, match_result_rejections.comment), created_at = NOW()`,
      [matchId, userId, comment ?? null],
    );
    await this.db.query(
      `DELETE FROM match_result_confirmations WHERE match_id = $1 AND user_id = $2`,
      [matchId, userId],
    );
  }

  async getPlayerRatingsForMatch(matchId: string) {
    const result = await this.db.query(
      `SELECT mpr.rater_user_id, mpr.rated_user_id, mpr.score, mpr.comment,
              ru.name AS rater_name, rd.name AS rated_name
       FROM match_player_ratings mpr
       INNER JOIN users ru ON ru.id = mpr.rater_user_id
       INNER JOIN users rd ON rd.id = mpr.rated_user_id
       WHERE mpr.match_id = $1`,
      [matchId],
    );
    return result.rows;
  }
}
