import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

const HISTORY_DAYS = 60;
const OCCUPANCY_THRESHOLD = 0.4;
const MIN_HISTORICAL_SLOTS = 5;
const MIN_PLAYER_MATCHES = 2;
const MAX_CANDIDATES_PER_SLOT = 30;
const MAX_NOTIFS_PER_USER_CLUB_DAY = 3;

type ValleyBucket = {
  dayOfWeek: number;
  hourBucket: number;
  occupancy: number;
  totalSlots: number;
  bookedSlots: number;
};

type OpenSlotRow = {
  id: string;
  club_id: string;
  court_label: string;
  slot_date: string;
  start_hour: number;
  end_hour: number;
  bonus_points: number;
  day_of_week: number;
  hour_bucket: number;
};

type ClubRow = {
  id: string;
  name: string;
  auto_fill_gaps_enabled: boolean;
  gap_fill_hours_before: number;
  gap_fill_auto_create_match: boolean;
  gap_fill_notify_enabled: boolean;
  zone?: string | null;
};

@Injectable()
export class ClubGapFillService {
  private readonly logger = new Logger(ClubGapFillService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async runForEnabledClubs(): Promise<{
    clubs: number;
    notified: number;
    matchesCreated: number;
  }> {
    const clubs = await this.db.query<ClubRow>(
      `SELECT id, name, auto_fill_gaps_enabled,
              COALESCE(gap_fill_hours_before, 8)::int AS gap_fill_hours_before,
              COALESCE(gap_fill_auto_create_match, FALSE) AS gap_fill_auto_create_match,
              COALESCE(gap_fill_notify_enabled, TRUE) AS gap_fill_notify_enabled,
              zone
       FROM clubs
       WHERE auto_fill_gaps_enabled = TRUE`,
    );

    let notified = 0;
    let matchesCreated = 0;
    for (const club of clubs.rows) {
      try {
        const result = await this.processClub(club);
        notified += result.notified;
        matchesCreated += result.matchesCreated;
      } catch (err) {
        this.logger.error(
          `Gap-fill falló para club ${club.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { clubs: clubs.rows.length, notified, matchesCreated };
  }

  /** Outreach inmediato cuando un turno vuelve a OPEN (p. ej. cancelación). */
  async outreachForReleasedSlot(slotId: string): Promise<number> {
    if (!slotId) return 0;

    const slotResult = await this.db.query<OpenSlotRow & { club_name: string; enabled: boolean }>(
      `SELECT cas.id,
              cas.club_id,
              cas.court_label,
              cas.slot_date::text AS slot_date,
              cas.start_hour::float8 AS start_hour,
              cas.end_hour::float8 AS end_hour,
              cas.bonus_points,
              EXTRACT(DOW FROM cas.slot_date)::int AS day_of_week,
              FLOOR(cas.start_hour)::int AS hour_bucket,
              c.name AS club_name,
              c.auto_fill_gaps_enabled AS enabled
       FROM court_availability_slots cas
       INNER JOIN clubs c ON c.id = cas.club_id
       WHERE cas.id = $1
         AND cas.status = 'OPEN'
         AND (cas.slot_date::timestamp + (cas.end_hour * INTERVAL '1 hour')) > NOW()`,
      [slotId],
    );

    const slot = slotResult.rows[0];
    if (!slot?.enabled) return 0;

    const valleys = await this.detectValleyBuckets(slot.club_id);
    const isValley = valleys.some(
      (v) => v.dayOfWeek === slot.day_of_week && v.hourBucket === slot.hour_bucket,
    );
    // Al liberar, siempre intentamos avisar a regulares aunque no sea valle histórico,
    // pero priorizamos franjas valle; si no es valle, igual notificamos (cancha liberada).
    return this.notifyCandidatesForSlot(
      {
        id: slot.club_id,
        name: slot.club_name,
        auto_fill_gaps_enabled: true,
        gap_fill_hours_before: 8,
        gap_fill_auto_create_match: false,
        gap_fill_notify_enabled: true,
      },
      slot,
      isValley ? 'valley' : 'released',
    );
  }

  async getDemandInsights(clubId: string) {
    const club = await this.db.query<ClubRow>(
      `SELECT id, name, auto_fill_gaps_enabled,
              COALESCE(gap_fill_hours_before, 8)::int AS gap_fill_hours_before,
              COALESCE(gap_fill_auto_create_match, FALSE) AS gap_fill_auto_create_match,
              COALESCE(gap_fill_notify_enabled, TRUE) AS gap_fill_notify_enabled,
              zone
       FROM clubs WHERE id = $1`,
      [clubId],
    );
    const config = club.rows[0];
    const valleys = await this.detectValleyBuckets(clubId);
    const withCandidates = await Promise.all(
      valleys.map(async (v) => {
        const candidates = await this.findCandidateUserIds(
          clubId,
          v.dayOfWeek,
          v.hourBucket,
          v.hourBucket + 1,
        );
        return {
          dayOfWeek: v.dayOfWeek,
          hourBucket: v.hourBucket,
          occupancyPct: Math.round(v.occupancy * 100),
          totalSlots: v.totalSlots,
          bookedSlots: v.bookedSlots,
          candidateCount: candidates.length,
        };
      }),
    );

    return {
      historyDays: HISTORY_DAYS,
      occupancyThresholdPct: Math.round(OCCUPANCY_THRESHOLD * 100),
      rules: {
        enabled: Boolean(config?.auto_fill_gaps_enabled),
        hoursBefore: Number(config?.gap_fill_hours_before ?? 8),
        autoCreateMatch: Boolean(config?.gap_fill_auto_create_match),
        notifyEnabled: config?.gap_fill_notify_enabled !== false,
      },
      valleys: withCandidates.sort(
        (a, b) => a.dayOfWeek - b.dayOfWeek || a.hourBucket - b.hourBucket,
      ),
    };
  }

  private async processClub(
    club: ClubRow,
  ): Promise<{ notified: number; matchesCreated: number }> {
    const valleys = await this.detectValleyBuckets(club.id);
    if (valleys.length === 0) return { notified: 0, matchesCreated: 0 };

    const valleyKeys = new Set(valleys.map((v) => `${v.dayOfWeek}:${v.hourBucket}`));
    const hoursBefore = Math.min(72, Math.max(1, Number(club.gap_fill_hours_before || 8)));
    const slots = await this.listOpenValleySlots(club.id, valleyKeys, hoursBefore);

    let notified = 0;
    let matchesCreated = 0;
    for (const slot of slots) {
      if (club.gap_fill_auto_create_match) {
        const created = await this.autoCreateOpenMatch(club, slot);
        if (created) {
          matchesCreated += 1;
          if (club.gap_fill_notify_enabled !== false) {
            notified += await this.notifyCandidatesForSlot(club, slot, 'valley', created.matchId);
          }
          continue;
        }
      }
      if (club.gap_fill_notify_enabled !== false) {
        notified += await this.notifyCandidatesForSlot(club, slot, 'valley');
      }
    }
    return { notified, matchesCreated };
  }

  async detectValleyBuckets(clubId: string): Promise<ValleyBucket[]> {
    const result = await this.db.query<{
      day_of_week: number;
      hour_bucket: number;
      total_slots: number;
      booked_slots: number;
    }>(
      `SELECT EXTRACT(DOW FROM slot_date)::int AS day_of_week,
              FLOOR(start_hour)::int AS hour_bucket,
              COUNT(*)::int AS total_slots,
              COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked_slots
       FROM court_availability_slots
       WHERE club_id = $1
         AND status IN ('OPEN', 'BOOKED', 'CANCELLED')
         AND slot_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
         AND slot_date < CURRENT_DATE
       GROUP BY 1, 2
       HAVING COUNT(*) >= $3`,
      [clubId, HISTORY_DAYS, MIN_HISTORICAL_SLOTS],
    );

    return result.rows
      .map((row) => {
        const occupancy = row.total_slots > 0 ? row.booked_slots / row.total_slots : 0;
        return {
          dayOfWeek: row.day_of_week,
          hourBucket: row.hour_bucket,
          occupancy,
          totalSlots: row.total_slots,
          bookedSlots: row.booked_slots,
        };
      })
      .filter((b) => b.occupancy < OCCUPANCY_THRESHOLD);
  }

  private async listOpenValleySlots(
    clubId: string,
    valleyKeys: Set<string>,
    hoursBefore: number,
  ): Promise<OpenSlotRow[]> {
    const result = await this.db.query<OpenSlotRow>(
      `SELECT cas.id,
              cas.club_id,
              cas.court_label,
              cas.slot_date::text AS slot_date,
              cas.start_hour::float8 AS start_hour,
              cas.end_hour::float8 AS end_hour,
              cas.bonus_points,
              EXTRACT(DOW FROM cas.slot_date)::int AS day_of_week,
              FLOOR(cas.start_hour)::int AS hour_bucket
       FROM court_availability_slots cas
       WHERE cas.club_id = $1
         AND cas.status = 'OPEN'
         AND (cas.slot_date::timestamp + (cas.start_hour * INTERVAL '1 hour')) >= NOW()
         AND (cas.slot_date::timestamp + (cas.start_hour * INTERVAL '1 hour'))
             <= NOW() + ($2::int * INTERVAL '1 hour')
         AND NOT EXISTS (
           SELECT 1 FROM matches m
           WHERE m.court_slot_id = cas.id
             AND m.status NOT IN ('CANCELLED')
         )
       ORDER BY cas.slot_date ASC, cas.start_hour ASC`,
      [clubId, hoursBefore],
    );

    return result.rows.filter((s) => valleyKeys.has(`${s.day_of_week}:${s.hour_bucket}`));
  }

  /** Publica un partido abierto y reserva el slot (estilo SmartClub). */
  private async autoCreateOpenMatch(
    club: ClubRow,
    slot: OpenSlotRow,
  ): Promise<{ matchId: string } | null> {
    const admin = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM club_admins WHERE club_id = $1 LIMIT 1`,
      [club.id],
    );
    const createdBy = admin.rows[0]?.user_id;
    if (!createdBy) {
      this.logger.warn(`Club ${club.id} sin club_admins; no se auto-crea partido`);
      return null;
    }

    const dateResult = await this.db.query<{ starts_at: string; ends_at: string }>(
      `SELECT (cas.slot_date::timestamp + (cas.start_hour * INTERVAL '1 hour')) AS starts_at,
              (cas.slot_date::timestamp + (cas.end_hour * INTERVAL '1 hour')) AS ends_at
       FROM court_availability_slots cas
       WHERE cas.id = $1 AND cas.status = 'OPEN'`,
      [slot.id],
    );
    const startsAt = dateResult.rows[0]?.starts_at;
    const endsAt = dateResult.rows[0]?.ends_at;
    if (!startsAt) return null;

    const dateLabel = String(slot.slot_date).slice(0, 10);
    const title = `Partido abierto · ${slot.court_label}`;
    const description = `Publicado automáticamente por Smart Fill · ${dateLabel} ${formatHourLabel(slot.start_hour)}–${formatHourLabel(slot.end_hour)}`;

    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO matches (
         club_id, created_by_user_id, title, description, date, ends_at, zone,
         level_min, level_max, gender, mode, needed_players, court_slot_id,
         court_booking, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open','friendly',4,$10,'in_app','OPEN')
       RETURNING id`,
      [
        club.id,
        createdBy,
        title,
        description,
        startsAt,
        endsAt ?? null,
        club.zone ?? null,
        0,
        1000,
        slot.id,
      ],
    );
    const matchId = inserted.rows[0]?.id;
    if (!matchId) return null;

    await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'BOOKED'
       WHERE id = $1 AND club_id = $2 AND status = 'OPEN'`,
      [slot.id, club.id],
    );

    this.logger.log(`Smart Fill: partido ${matchId} creado para slot ${slot.id} (${club.name})`);
    return { matchId };
  }

  private async notifyCandidatesForSlot(
    club: ClubRow,
    slot: OpenSlotRow,
    reason: 'valley' | 'released',
    matchId?: string,
  ): Promise<number> {
    const candidates = await this.findCandidateUserIds(
      club.id,
      slot.day_of_week,
      slot.start_hour,
      slot.end_hour,
    );
    if (candidates.length === 0) return 0;

    const promo = await this.findActivePromotion(
      club.id,
      slot.day_of_week,
      slot.start_hour,
      slot.end_hour,
    );
    const bonus = Math.max(Number(slot.bonus_points ?? 0), promo?.bonus_points ?? 0);

    const dateLabel = String(slot.slot_date).slice(0, 10);
    const startLabel = formatHourLabel(slot.start_hour);
    const endLabel = formatHourLabel(slot.end_hour);

    const title = matchId
      ? `Partido abierto en ${club.name}`
      : bonus > 0
        ? `Horario con bonus (+${bonus} pts) · ${club.name}`
        : reason === 'released'
          ? `Cancha liberada en ${club.name}`
          : `Cancha libre en ${club.name}`;
    const body = matchId
      ? `${slot.court_label} · ${dateLabel} ${startLabel}–${endLabel} · Unite al partido`
      : bonus > 0
        ? `${slot.court_label} · ${dateLabel} ${startLabel}–${endLabel} · Sumá puntos del club`
        : `${slot.court_label} · ${dateLabel} ${startLabel}–${endLabel}`;

    let sent = 0;
    for (const userId of candidates) {
      const allowed = await this.tryReserveOutreach(club.id, slot.id, userId);
      if (!allowed) continue;

      await this.notifications.create({
        userId,
        type: matchId ? 'OPEN_MATCH_CREATED' : 'COURT_GAP_OFFER',
        title,
        body,
        data: {
          clubId: club.id,
          slotId: slot.id,
          matchId: matchId ?? null,
          slotDate: dateLabel,
          startHour: slot.start_hour,
          endHour: slot.end_hour,
          bonusPoints: bonus,
          reason,
          promotionLabel: promo?.label ?? null,
        },
      });
      sent += 1;
    }
    return sent;
  }

  private async findCandidateUserIds(
    clubId: string,
    dayOfWeek: number,
    startHour: number,
    endHour: number,
  ): Promise<string[]> {
    const hourStart = typeof startHour === 'number' ? startHour : Number(startHour);
    const hourEnd = typeof endHour === 'number' ? endHour : Number(endHour);
    // Para buckets de insights usamos hourBucket..hourBucket+1; para slots reales start/end.
    const rangeStart = hourStart;
    const rangeEnd = hourEnd <= hourStart ? hourStart + 1 : hourEnd;

    const result = await this.db.query<{ id: string }>(
      `WITH availability AS (
         SELECT DISTINCT pa.user_id AS id
         FROM player_availability pa
         INNER JOIN users u ON u.id = pa.user_id AND u.role = 'PLAYER'
         WHERE pa.day_of_week = $2
           AND pa.start_hour < $4
           AND pa.end_hour > $3
           AND (pa.club_id IS NULL OR pa.club_id = $1)
       ),
       history AS (
         SELECT p.user_id AS id
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         INNER JOIN matches m ON m.id = mp.match_id
         INNER JOIN court_availability_slots cas ON cas.id = m.court_slot_id
         WHERE m.club_id = $1
           AND m.status = 'FINISHED'
           AND mp.status IN ('JOINED', 'CONFIRMED')
           AND m.date >= NOW() - INTERVAL '90 days'
           AND EXTRACT(DOW FROM cas.slot_date)::int = $2
           AND cas.start_hour < $4
           AND cas.end_hour > $3
         GROUP BY p.user_id
         HAVING COUNT(DISTINCT m.id) >= $5
       )
       SELECT id FROM availability
       UNION
       SELECT id FROM history
       LIMIT $6`,
      [clubId, dayOfWeek, rangeStart, rangeEnd, MIN_PLAYER_MATCHES, MAX_CANDIDATES_PER_SLOT],
    );

    return result.rows.map((r) => r.id);
  }

  private async findActivePromotion(
    clubId: string,
    dayOfWeek: number,
    startHour: number,
    endHour: number,
  ): Promise<{ label: string; bonus_points: number } | null> {
    const result = await this.db.query<{ label: string; bonus_points: number }>(
      `SELECT label, bonus_points
       FROM club_promotions
       WHERE club_id = $1
         AND active = TRUE
         AND (day_of_week IS NULL OR day_of_week = $2)
         AND start_hour < $4
         AND end_hour > $3
       ORDER BY bonus_points DESC
       LIMIT 1`,
      [clubId, dayOfWeek, startHour, endHour],
    );
    return result.rows[0] ?? null;
  }

  private async tryReserveOutreach(
    clubId: string,
    slotId: string,
    userId: string,
  ): Promise<boolean> {
    const dayCount = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM club_gap_fill_notifications
       WHERE club_id = $1
         AND user_id = $2
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [clubId, userId],
    );
    if ((dayCount.rows[0]?.count ?? 0) >= MAX_NOTIFS_PER_USER_CLUB_DAY) {
      return false;
    }

    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO club_gap_fill_notifications (club_id, slot_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (slot_id, user_id) DO NOTHING
       RETURNING id`,
      [clubId, slotId, userId],
    );
    return Boolean(inserted.rows[0]);
  }
}

function formatHourLabel(hour: number): string {
  const totalMinutes = Math.round(Number(hour) * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
