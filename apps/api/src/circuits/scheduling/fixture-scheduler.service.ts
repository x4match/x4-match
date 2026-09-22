import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import {
  buildVenueSlots,
  eachDayKey,
  expandWeeklyToEventDays,
  intersectTeamWindows,
  rangesOverlap,
  teamCoversSlot,
  type AvailabilityWindow,
  type CourtSlot,
  type TeamAvailability,
  type WeeklyAvailabilitySlot,
} from './availability.helpers';

export type ScheduleAssignment = {
  matchId: string;
  tournamentId: string;
  categoryLabel: string | null;
  clubId: string;
  clubName: string;
  courtLabel: string;
  scheduledAt: string;
  score: number;
  warnings: string[];
};

export type SchedulePreviewResult = {
  eventId: string;
  eventName: string;
  scheduleStatus: string;
  assignments: ScheduleAssignment[];
  unassigned: Array<{ matchId: string; tournamentId: string; reason: string }>;
  metrics: {
    totalMatches: number;
    assigned: number;
    unassigned: number;
    venuesUsed: number;
    slotsAvailable: number;
  };
};

type ScheduleOptions = {
  matchDurationMinutes?: number;
  dayStartHour?: number;
  dayEndHour?: number;
  strictAvailability?: boolean;
  resetExisting?: boolean;
  publish?: boolean;
};

@Injectable()
export class FixtureSchedulerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async previewEventSchedule(
    circuitId: string,
    eventId: string,
    userId: string,
    options: ScheduleOptions = {},
  ): Promise<SchedulePreviewResult> {
    await this.assertCanManage(circuitId, userId);
    return this.buildPreview(circuitId, eventId, options);
  }

  async applyEventSchedule(
    circuitId: string,
    eventId: string,
    userId: string,
    options: ScheduleOptions = {},
  ): Promise<SchedulePreviewResult> {
    await this.assertCanManage(circuitId, userId);
    const preview = await this.buildPreview(circuitId, eventId, {
      ...options,
      resetExisting: options.resetExisting !== false,
    });

    const publish = !!options.publish;
    const eventRow = await this.getEvent(eventId);

    if (options.resetExisting !== false) {
      await this.clearEventSchedule(eventId, !publish);
    }

    for (const a of preview.assignments) {
      await this.db.query(
        `UPDATE tournament_matches
         SET club_id = $2,
             court_label = $3,
             scheduled_at = $4::timestamptz,
             schedule_published = $5,
             updated_at = NOW()
         WHERE id = $1`,
        [a.matchId, a.clubId, a.courtLabel, a.scheduledAt, publish],
      );
    }

    await this.db.query(
      `UPDATE circuit_events
       SET schedule_status = $2, updated_at = NOW(),
           match_duration_minutes = COALESCE($3, match_duration_minutes),
           day_start_hour = COALESCE($4, day_start_hour),
           day_end_hour = COALESCE($5, day_end_hour)
       WHERE id = $1`,
      [
        eventId,
        publish ? 'PUBLISHED' : 'DRAFT',
        options.matchDurationMinutes ?? eventRow.match_duration_minutes,
        options.dayStartHour ?? eventRow.day_start_hour,
        options.dayEndHour ?? eventRow.day_end_hour,
      ],
    );

    this.realtime.emitCircuitEventUpdated({
      circuitId,
      eventId,
      type: publish ? 'schedule_published' : 'schedule_draft_saved',
    });

    if (publish) {
      await this.notifyPlayersOfSchedule(preview.assignments, circuitId, eventId);
    }

    return {
      ...preview,
      scheduleStatus: publish ? 'PUBLISHED' : 'DRAFT',
    };
  }

  async publishExistingSchedule(circuitId: string, eventId: string, userId: string) {
    await this.assertCanManage(circuitId, userId);
    const event = await this.getEvent(eventId);
    if (event.circuit_id !== circuitId) throw new NotFoundException('Evento no encontrado');

    await this.db.query(
      `UPDATE tournament_matches tm
       SET schedule_published = TRUE, updated_at = NOW()
       FROM circuit_stages cs
       WHERE cs.event_id = $1
         AND cs.tournament_id = tm.tournament_id
         AND tm.scheduled_at IS NOT NULL`,
      [eventId],
    );
    await this.db.query(
      `UPDATE circuit_events SET schedule_status = 'PUBLISHED', updated_at = NOW() WHERE id = $1`,
      [eventId],
    );

    this.realtime.emitCircuitEventUpdated({
      circuitId,
      eventId,
      type: 'schedule_published',
    });

    const schedule = await this.getPublishedSchedule(circuitId, eventId, {});
    await this.notifyPlayersOfSchedule(
      schedule.matches.map((m) => ({
        matchId: m.id,
        tournamentId: m.tournamentId,
        categoryLabel: m.categoryLabel,
        clubId: m.clubId!,
        clubName: m.clubName || '',
        courtLabel: m.courtLabel || '',
        scheduledAt: m.scheduledAt!,
        score: 0,
        warnings: [],
      })),
      circuitId,
      eventId,
    );

    return { published: true, count: schedule.matches.length };
  }

  async ensureBracketsForEvent(
    circuitId: string,
    eventId: string,
    userId: string,
    mode: 'OPEN_COURT' | 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' = 'OPEN_COURT',
  ) {
    await this.assertCanManage(circuitId, userId);
    const stages = await this.db.query(
      `SELECT cs.id, cs.tournament_id, t.format
       FROM circuit_stages cs
       LEFT JOIN tournaments t ON t.id = cs.tournament_id
       WHERE cs.event_id = $1 AND cs.circuit_id = $2`,
      [eventId, circuitId],
    );

    const results: Array<{ tournamentId: string; created: number; skipped?: string }> = [];
    for (const stage of stages.rows) {
      if (!stage.tournament_id) {
        results.push({ tournamentId: '', created: 0, skipped: 'Sin torneo publicado' });
        continue;
      }
      const existing = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM tournament_matches WHERE tournament_id = $1`,
        [stage.tournament_id],
      );
      if (Number(existing.rows[0].c) > 0) {
        results.push({ tournamentId: stage.tournament_id, created: 0, skipped: 'Ya tiene fixture' });
        continue;
      }

      const approved = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM tournament_registrations
         WHERE tournament_id = $1 AND status = 'APPROVED'`,
        [stage.tournament_id],
      );
      if (Number(approved.rows[0].c) < 2) {
        results.push({
          tournamentId: stage.tournament_id,
          created: 0,
          skipped: 'Menos de 2 parejas aprobadas',
        });
        continue;
      }

      // Lazy import path: call SQL generation via tournaments-compatible logic locally
      const created = await this.generateOpenCourtOrElimination(stage.tournament_id, mode);
      results.push({ tournamentId: stage.tournament_id, created });
    }
    return { results };
  }

  async getPublishedSchedule(
    circuitId: string,
    eventId: string,
    filters: {
      categoryId?: string;
      clubId?: string;
      date?: string;
      status?: string;
      q?: string;
      includeDraft?: boolean;
      viewerUserId?: string;
    },
  ) {
    const event = await this.getEvent(eventId);
    if (event.circuit_id !== circuitId) throw new NotFoundException('Evento no encontrado');

    const includeDraft = !!filters.includeDraft;
    const params: unknown[] = [eventId];
    let where = `cs.event_id = $1 AND tm.scheduled_at IS NOT NULL`;
    if (!includeDraft) {
      where += ` AND tm.schedule_published = TRUE AND e.schedule_status = 'PUBLISHED'`;
    }

    if (filters.categoryId) {
      params.push(filters.categoryId);
      where += ` AND cs.category_id = $${params.length}`;
    }
    if (filters.clubId) {
      params.push(filters.clubId);
      where += ` AND tm.club_id = $${params.length}`;
    }
    if (filters.date) {
      params.push(filters.date);
      where += ` AND (tm.scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = $${params.length}::date`;
    }
    if (filters.status) {
      params.push(filters.status);
      where += ` AND tm.status::text = $${params.length}`;
    }
    if (filters.q?.trim()) {
      params.push(`%${filters.q.trim().toLowerCase()}%`);
      where += ` AND (
        LOWER(COALESCE(tm.team_a_name,'')) LIKE $${params.length}
        OR LOWER(COALESCE(tm.team_b_name,'')) LIKE $${params.length}
      )`;
    }

    const result = await this.db.query(
      `SELECT tm.id, tm.tournament_id, tm.round, tm.round_label, tm.court_label, tm.club_id,
              tm.team_a_name, tm.team_b_name, tm.status, tm.score, tm.scheduled_at,
              tm.schedule_published, tm.team_a_registration_id, tm.team_b_registration_id,
              t.name AS tournament_name, cc.label AS category_label, cc.gender AS category_gender,
              cl.name AS club_name, cl.city AS club_city, cl.address AS club_address,
              e.name AS event_name, e.schedule_status
       FROM tournament_matches tm
       INNER JOIN tournaments t ON t.id = tm.tournament_id
       INNER JOIN circuit_stages cs ON cs.tournament_id = t.id
       INNER JOIN circuit_events e ON e.id = cs.event_id
       LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
       LEFT JOIN clubs cl ON cl.id = tm.club_id
       WHERE ${where}
       ORDER BY tm.scheduled_at ASC NULLS LAST, cl.name ASC, tm.court_label ASC`,
      params,
    );

    const matches = result.rows.map((row) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      tournamentName: row.tournament_name,
      categoryLabel: row.category_label
        ? [row.category_label, row.category_gender].filter(Boolean).join(' ')
        : null,
      round: row.round,
      roundLabel: row.round_label,
      clubId: row.club_id,
      clubName: row.club_name,
      clubCity: row.club_city,
      clubAddress: row.club_address,
      courtLabel: row.court_label,
      teamAName: row.team_a_name,
      teamBName: row.team_b_name,
      status: row.status,
      score: row.score,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      schedulePublished: row.schedule_published,
      teamARegistrationId: row.team_a_registration_id,
      teamBRegistrationId: row.team_b_registration_id,
    }));

    return {
      eventId,
      eventName: event.name,
      scheduleStatus: event.schedule_status,
      startDate: event.start_date,
      endDate: event.end_date ?? event.start_date,
      matches,
      progress: {
        total: matches.length,
        finished: matches.filter((m) => m.status === 'FINISHED').length,
      },
    };
  }

  async getMyEventMatches(circuitId: string, eventId: string, userId: string) {
    const schedule = await this.getPublishedSchedule(circuitId, eventId, {});
    const regs = await this.db.query(
      `SELECT tr.id
       FROM tournament_registrations tr
       INNER JOIN circuit_stages cs ON cs.tournament_id = tr.tournament_id
       WHERE cs.event_id = $1
         AND (tr.player1_user_id = $2 OR tr.player2_user_id = $2)`,
      [eventId, userId],
    );
    const myRegIds = new Set(regs.rows.map((r) => r.id));
    const matches = schedule.matches.filter(
      (m) =>
        (m.teamARegistrationId && myRegIds.has(m.teamARegistrationId)) ||
        (m.teamBRegistrationId && myRegIds.has(m.teamBRegistrationId)),
    );
    return { ...schedule, matches };
  }

  async updateMatchSchedule(
    circuitId: string,
    eventId: string,
    matchId: string,
    userId: string,
    payload: { clubId: string; courtLabel: string; scheduledAt: string; publish?: boolean },
  ) {
    await this.assertCanManage(circuitId, userId);
    const event = await this.getEvent(eventId);
    if (event.circuit_id !== circuitId) throw new NotFoundException('Evento no encontrado');

    const venue = await this.db.query(
      `SELECT 1 FROM circuit_event_venues WHERE event_id = $1 AND club_id = $2`,
      [eventId, payload.clubId],
    );
    if (!venue.rows[0]) throw new BadRequestException('La sede no pertenece al evento');

    const match = await this.db.query(
      `SELECT tm.id, tm.tournament_id
       FROM tournament_matches tm
       INNER JOIN circuit_stages cs ON cs.tournament_id = tm.tournament_id
       WHERE tm.id = $1 AND cs.event_id = $2`,
      [matchId, eventId],
    );
    if (!match.rows[0]) throw new NotFoundException('Partido no encontrado');

    const publish =
      payload.publish === true || event.schedule_status === 'PUBLISHED';

    await this.db.query(
      `UPDATE tournament_matches
       SET club_id = $2, court_label = $3, scheduled_at = $4::timestamptz,
           schedule_published = $5, updated_at = NOW()
       WHERE id = $1`,
      [matchId, payload.clubId, payload.courtLabel, payload.scheduledAt, publish],
    );

    this.realtime.emitCircuitEventUpdated({
      circuitId,
      eventId,
      type: 'match_rescheduled',
      matchId,
    });
    this.realtime.emitTournamentUpdated({
      tournamentId: match.rows[0].tournament_id,
      type: 'match_updated',
    });

    return this.getPublishedSchedule(circuitId, eventId, { includeDraft: true });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async buildPreview(
    circuitId: string,
    eventId: string,
    options: ScheduleOptions,
  ): Promise<SchedulePreviewResult> {
    const event = await this.getEvent(eventId);
    if (event.circuit_id !== circuitId) throw new NotFoundException('Evento no encontrado');

    const venuesRes = await this.db.query(
      `SELECT cev.club_id, cev.courts_count, cev.is_primary, cl.name AS club_name
       FROM circuit_event_venues cev
       INNER JOIN clubs cl ON cl.id = cev.club_id
       WHERE cev.event_id = $1
       ORDER BY cev.is_primary DESC, cev.sort_order ASC, cl.name ASC`,
      [eventId],
    );
    if (!venuesRes.rows.length) {
      throw new BadRequestException('Agregá al menos una sede al evento');
    }

    const start = new Date(event.start_date);
    const end = new Date(event.end_date || event.start_date);
    const dayKeys = eachDayKey(start, end);
    const duration = options.matchDurationMinutes ?? (Number(event.match_duration_minutes) || 90);
    const dayStart = options.dayStartHour ?? (Number(event.day_start_hour) || 9);
    const dayEnd = options.dayEndHour ?? (Number(event.day_end_hour) || 22);
    const strict = !!options.strictAvailability;

    const slots = buildVenueSlots({
      venues: venuesRes.rows.map((v) => ({
        clubId: v.club_id,
        clubName: v.club_name,
        courtsCount: Number(v.courts_count) || 2,
        isPrimary: !!v.is_primary,
      })),
      dayKeys,
      dayStartHour: dayStart,
      dayEndHour: dayEnd,
      matchDurationMinutes: duration,
    });

    const matchesRes = await this.db.query(
      `SELECT tm.id, tm.tournament_id, tm.team_a_registration_id, tm.team_b_registration_id,
              tm.team_a_name, tm.team_b_name, tm.round, tm.status, tm.scheduled_at,
              cc.label AS category_label
       FROM tournament_matches tm
       INNER JOIN circuit_stages cs ON cs.tournament_id = tm.tournament_id
       LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
       WHERE cs.event_id = $1
         AND tm.status <> 'CANCELLED'
         AND tm.team_a_registration_id IS NOT NULL
         AND tm.team_b_registration_id IS NOT NULL`,
      [eventId],
    );

    const regIds = [
      ...new Set(
        matchesRes.rows.flatMap((m) => [m.team_a_registration_id, m.team_b_registration_id]),
      ),
    ];
    const teamAvail = await this.loadTeamAvailabilities(regIds, dayKeys);

    type PendingMatch = {
      id: string;
      tournamentId: string;
      categoryLabel: string | null;
      teamAId: string;
      teamBId: string;
      feasibleCount: number;
    };

    const pending: PendingMatch[] = matchesRes.rows.map((m) => {
      const a = teamAvail.get(m.team_a_registration_id);
      const b = teamAvail.get(m.team_b_registration_id);
      let feasibleCount = 0;
      for (const slot of slots) {
        const ca = a
          ? teamCoversSlot(a, slot.dayDate, slot.startHour, slot.endHour, slot.clubId, strict)
          : { ok: !strict, score: 0 };
        const cb = b
          ? teamCoversSlot(b, slot.dayDate, slot.startHour, slot.endHour, slot.clubId, strict)
          : { ok: !strict, score: 0 };
        if (ca.ok && cb.ok) feasibleCount++;
      }
      return {
        id: m.id,
        tournamentId: m.tournament_id,
        categoryLabel: m.category_label,
        teamAId: m.team_a_registration_id,
        teamBId: m.team_b_registration_id,
        feasibleCount,
      };
    });

    pending.sort((x, y) => x.feasibleCount - y.feasibleCount);

    const usedCourtKeys = new Set<string>();
    const teamBusy: Array<{ teamId: string; start: Date; end: Date }> = [];
    const durationMs = duration * 60_000;
    const assignments: ScheduleAssignment[] = [];
    const unassigned: Array<{ matchId: string; tournamentId: string; reason: string }> = [];
    const venuesUsed = new Set<string>();

    for (const match of pending) {
      const teamA = teamAvail.get(match.teamAId);
      const teamB = teamAvail.get(match.teamBId);
      let best: { slot: CourtSlot; score: number; warnings: string[] } | null = null;

      for (const slot of slots) {
        const courtKey = `${slot.clubId}|${slot.courtLabel}|${slot.startAt.toISOString()}`;
        if (usedCourtKeys.has(courtKey)) continue;

        const clashA = teamBusy.some(
          (b) =>
            b.teamId === match.teamAId &&
            rangesOverlap(b.start, durationMs, slot.startAt, durationMs),
        );
        const clashB = teamBusy.some(
          (b) =>
            b.teamId === match.teamBId &&
            rangesOverlap(b.start, durationMs, slot.startAt, durationMs),
        );
        if (clashA || clashB) continue;

        const ca = teamA
          ? teamCoversSlot(teamA, slot.dayDate, slot.startHour, slot.endHour, slot.clubId, strict)
          : { ok: !strict, score: 5, warning: 'Sin disponibilidad' };
        const cb = teamB
          ? teamCoversSlot(teamB, slot.dayDate, slot.startHour, slot.endHour, slot.clubId, strict)
          : { ok: !strict, score: 5, warning: 'Sin disponibilidad' };
        if (!ca.ok || !cb.ok) continue;

        let score = ca.score + cb.score;
        if (slot.isPrimary) score += 5;
        // Prefer same venue if team already played there earlier in assignment list
        const sameVenueBonus = assignments.some(
          (a) =>
            (a.matchId !== match.id &&
              (teamBusy.some((t) => t.teamId === match.teamAId) ||
                teamBusy.some((t) => t.teamId === match.teamBId))) &&
            a.clubId === slot.clubId,
        );
        if (sameVenueBonus) score += 8;

        const warnings = [ca.warning, cb.warning].filter(Boolean) as string[];
        if (!best || score > best.score) {
          best = { slot, score, warnings };
        }
      }

      if (!best) {
        unassigned.push({
          matchId: match.id,
          tournamentId: match.tournamentId,
          reason: strict
            ? 'Sin slot que cumpla disponibilidad y canchas'
            : 'Sin canchas libres en el rango del evento',
        });
        continue;
      }

      const courtKey = `${best.slot.clubId}|${best.slot.courtLabel}|${best.slot.startAt.toISOString()}`;
      usedCourtKeys.add(courtKey);
      teamBusy.push(
        { teamId: match.teamAId, start: best.slot.startAt, end: new Date(best.slot.startAt.getTime() + durationMs) },
        { teamId: match.teamBId, start: best.slot.startAt, end: new Date(best.slot.startAt.getTime() + durationMs) },
      );
      venuesUsed.add(best.slot.clubId);
      assignments.push({
        matchId: match.id,
        tournamentId: match.tournamentId,
        categoryLabel: match.categoryLabel,
        clubId: best.slot.clubId,
        clubName: best.slot.clubName,
        courtLabel: best.slot.courtLabel,
        scheduledAt: best.slot.startAt.toISOString(),
        score: best.score,
        warnings: best.warnings,
      });
    }

    return {
      eventId,
      eventName: event.name,
      scheduleStatus: event.schedule_status,
      assignments,
      unassigned,
      metrics: {
        totalMatches: pending.length,
        assigned: assignments.length,
        unassigned: unassigned.length,
        venuesUsed: venuesUsed.size,
        slotsAvailable: slots.length,
      },
    };
  }

  private async loadTeamAvailabilities(
    registrationIds: string[],
    dayKeys: string[],
  ): Promise<Map<string, TeamAvailability>> {
    const map = new Map<string, TeamAvailability>();
    if (!registrationIds.length) return map;

    const regs = await this.db.query(
      `SELECT id, player1_user_id, player2_user_id FROM tournament_registrations
       WHERE id = ANY($1::uuid[])`,
      [registrationIds],
    );

    const snapshots = await this.db.query(
      `SELECT registration_id, day_date::text AS day_date, start_hour, end_hour, preferred_club_id
       FROM tournament_registration_availability
       WHERE registration_id = ANY($1::uuid[])`,
      [registrationIds],
    );

    const userIds = [
      ...new Set(
        regs.rows.flatMap((r) => [r.player1_user_id, r.player2_user_id].filter(Boolean)),
      ),
    ];
    const weekly =
      userIds.length > 0
        ? await this.db.query(
            `SELECT user_id, day_of_week, start_hour, end_hour, club_id
             FROM player_availability WHERE user_id = ANY($1::uuid[])`,
            [userIds],
          )
        : { rows: [] as any[] };

    const weeklyByUser = new Map<string, WeeklyAvailabilitySlot[]>();
    for (const row of weekly.rows) {
      const list = weeklyByUser.get(row.user_id) ?? [];
      list.push({
        dayOfWeek: Number(row.day_of_week),
        startHour: Number(row.start_hour),
        endHour: Number(row.end_hour),
        clubId: row.club_id,
      });
      weeklyByUser.set(row.user_id, list);
    }

    const snapByReg = new Map<string, AvailabilityWindow[]>();
    for (const row of snapshots.rows) {
      const list = snapByReg.get(row.registration_id) ?? [];
      list.push({
        dayDate: String(row.day_date).slice(0, 10),
        startHour: Number(row.start_hour),
        endHour: Number(row.end_hour),
        preferredClubId: row.preferred_club_id,
      });
      snapByReg.set(row.registration_id, list);
    }

    for (const reg of regs.rows) {
      const snap = snapByReg.get(reg.id) ?? [];
      let windows = snap;
      if (!windows.length) {
        const p1 = expandWeeklyToEventDays(weeklyByUser.get(reg.player1_user_id) ?? [], dayKeys);
        const p2 = expandWeeklyToEventDays(weeklyByUser.get(reg.player2_user_id) ?? [], dayKeys);
        windows = intersectTeamWindows(p1, p2, dayKeys);
      }
      const preferredClubIds = [
        ...new Set(windows.map((w) => w.preferredClubId).filter(Boolean) as string[]),
      ];
      map.set(reg.id, {
        registrationId: reg.id,
        windows,
        preferredClubIds,
        hasExplicitAvailability: windows.length > 0,
      });
    }
    return map;
  }

  private async generateOpenCourtOrElimination(
    tournamentId: string,
    mode: 'OPEN_COURT' | 'SINGLE_ELIMINATION' | 'ROUND_ROBIN',
  ): Promise<number> {
    const approved = await this.db.query(
      `SELECT id, player1_name, player2_name FROM tournament_registrations
       WHERE tournament_id = $1 AND status = 'APPROVED' ORDER BY created_at ASC`,
      [tournamentId],
    );
    const teams = approved.rows;
    if (teams.length < 2) return 0;
    const label = (t: any) => `${t.player1_name} / ${t.player2_name}`;
    const tournament = await this.db.query(
      `SELECT courts_available FROM tournaments WHERE id = $1`,
      [tournamentId],
    );
    const courts = Math.max(1, Number(tournament.rows[0]?.courts_available) || 2);

    if (mode === 'SINGLE_ELIMINATION') {
      // Minimal SE: first round only pairs
      let inserted = 0;
      const shuffled = [...teams];
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        await this.db.query(
          `INSERT INTO tournament_matches
            (tournament_id, round, round_label, team_a_registration_id, team_b_registration_id, team_a_name, team_b_name)
           VALUES ($1,1,'Ronda 1',$2,$3,$4,$5)`,
          [tournamentId, shuffled[i].id, shuffled[i + 1].id, label(shuffled[i]), label(shuffled[i + 1])],
        );
        inserted++;
      }
      return inserted;
    }

    if (mode === 'ROUND_ROBIN') {
      let inserted = 0;
      let round = 1;
      for (let a = 0; a < teams.length; a++) {
        for (let b = a + 1; b < teams.length; b++) {
          await this.db.query(
            `INSERT INTO tournament_matches
              (tournament_id, round, round_label, team_a_registration_id, team_b_registration_id, team_a_name, team_b_name)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              tournamentId,
              round,
              `Fecha ${round}`,
              teams[a].id,
              teams[b].id,
              label(teams[a]),
              label(teams[b]),
            ],
          );
          inserted++;
          round++;
        }
      }
      return inserted;
    }

    // OPEN_COURT circle method
    const n = teams.length;
    const withBye = n % 2 === 1 ? [...teams, null] : [...teams];
    const total = withBye.length;
    const half = total / 2;
    const roundCount = total - 1;
    let arr = [...withBye];
    let inserted = 0;
    let globalRound = 1;

    for (let r = 0; r < roundCount; r++) {
      const pairs: { a: any; b: any }[] = [];
      for (let i = 0; i < half; i++) {
        const a = arr[i];
        const b = arr[total - 1 - i];
        if (a && b) pairs.push({ a, b });
      }
      for (let offset = 0; offset < pairs.length; offset += courts) {
        const batch = pairs.slice(offset, offset + courts);
        const needsSub = pairs.length > courts ? `.${Math.floor(offset / courts) + 1}` : '';
        for (let courtIdx = 0; courtIdx < batch.length; courtIdx++) {
          const p = batch[courtIdx];
          await this.db.query(
            `INSERT INTO tournament_matches
              (tournament_id, round, round_label, court_label,
               team_a_registration_id, team_b_registration_id, team_a_name, team_b_name)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              tournamentId,
              globalRound,
              `Turno ${r + 1}${needsSub}`,
              `Cancha ${courtIdx + 1}`,
              p.a.id,
              p.b.id,
              label(p.a),
              label(p.b),
            ],
          );
          inserted++;
        }
        globalRound++;
      }
      const fixed = arr[0];
      const rest = arr.slice(1);
      const last = rest.pop();
      if (last !== undefined) rest.unshift(last);
      arr = [fixed, ...rest];
    }
    return inserted;
  }

  private async clearEventSchedule(eventId: string, keepUnpublishedOnly: boolean) {
    await this.db.query(
      `UPDATE tournament_matches tm
       SET club_id = NULL,
           scheduled_at = NULL,
           schedule_published = FALSE,
           updated_at = NOW()
       FROM circuit_stages cs
       WHERE cs.event_id = $1
         AND cs.tournament_id = tm.tournament_id
         AND ($2::boolean = FALSE OR tm.schedule_published = FALSE)`,
      [eventId, keepUnpublishedOnly],
    );
  }

  private async notifyPlayersOfSchedule(
    assignments: ScheduleAssignment[],
    circuitId: string,
    eventId: string,
  ) {
    if (!assignments.length) return;
    const matchIds = assignments.map((a) => a.matchId);
    const rows = await this.db.query(
      `SELECT tm.id, tm.scheduled_at, tm.court_label, cl.name AS club_name,
              ra.player1_user_id AS a1, ra.player2_user_id AS a2,
              rb.player1_user_id AS b1, rb.player2_user_id AS b2
       FROM tournament_matches tm
       LEFT JOIN clubs cl ON cl.id = tm.club_id
       LEFT JOIN tournament_registrations ra ON ra.id = tm.team_a_registration_id
       LEFT JOIN tournament_registrations rb ON rb.id = tm.team_b_registration_id
       WHERE tm.id = ANY($1::uuid[])`,
      [matchIds],
    );

    const payloads = [];
    for (const row of rows.rows) {
      const when = row.scheduled_at
        ? new Date(row.scheduled_at).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      const body = `${row.club_name || 'Sede'} · ${row.court_label || 'Cancha'} · ${when}`;
      for (const uid of [row.a1, row.a2, row.b1, row.b2].filter(Boolean)) {
        payloads.push({
          userId: uid as string,
          type: 'circuit_schedule',
          title: 'Horario de tu partido',
          body,
          data: { circuitId, eventId, matchId: row.id },
        });
      }
    }
    if (payloads.length) {
      await this.notifications.createMany(payloads);
    }
  }

  private async getEvent(eventId: string) {
    const res = await this.db.query(`SELECT * FROM circuit_events WHERE id = $1`, [eventId]);
    if (!res.rows[0]) throw new NotFoundException('Evento no encontrado');
    return res.rows[0];
  }

  private async assertCanManage(circuitId: string, userId: string) {
    const circuit = await this.db.query(
      `SELECT created_by_user_id FROM circuits WHERE id = $1`,
      [circuitId],
    );
    if (!circuit.rows[0]) throw new NotFoundException('Circuito no encontrado');
    const role = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const isAdmin = role.rows[0]?.role === 'SUPER_ADMIN';
    if (!isAdmin && circuit.rows[0].created_by_user_id !== userId) {
      throw new ForbiddenException('No podés gestionar este circuito');
    }
  }
}
