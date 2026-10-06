import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { BracketService } from '../../tournaments/brackets/bracket.service';
import {
  BYE_SOURCE,
  parseGroupSource,
  type FixtureMode,
} from '../../tournaments/brackets/bracket-engine';
import { CircuitAccessService } from '../circuit-access.service';
import { CircuitAuditService } from '../organizer/circuit-audit.service';
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

export type EnsureBracketsResult = {
  tournamentId: string;
  categoryLabel: string | null;
  created: number;
  skipped?: string;
  mode?: FixtureMode;
  groups?: number;
  knockoutSize?: number;
  teams?: number;
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
    private readonly access: CircuitAccessService,
    private readonly brackets: BracketService,
    private readonly audit: CircuitAuditService,
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
    await this.audit.log(circuitId, userId, {
      action: publish ? 'schedule.publish' : 'schedule.draft',
      entityType: 'circuit_event',
      entityId: eventId,
      summary: `${publish ? 'Publicó' : 'Guardó en borrador'} la grilla de ${eventRow.name}: ${preview.assignments.length} partido(s) asignados`,
    });

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
    await this.audit.log(circuitId, userId, {
      action: 'schedule.publish',
      entityType: 'circuit_event',
      entityId: eventId,
      summary: `Publicó la grilla de ${event.name}: ${schedule.matches.length} partido(s)`,
    });

    return { published: true, count: schedule.matches.length };
  }

  async ensureBracketsForEvent(
    circuitId: string,
    eventId: string,
    userId: string,
    options: { mode?: FixtureMode; regenerate?: boolean } = {},
  ) {
    await this.assertCanManage(circuitId, userId);
    const stages = await this.db.query(
      `SELECT cs.id, cs.tournament_id, cc.label AS category_label
       FROM circuit_stages cs
       LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
       WHERE cs.event_id = $1 AND cs.circuit_id = $2
       ORDER BY cc.label ASC NULLS LAST`,
      [eventId, circuitId],
    );

    const results: EnsureBracketsResult[] = [];
    for (const stage of stages.rows) {
      const base = { tournamentId: stage.tournament_id ?? '', categoryLabel: stage.category_label };
      if (!stage.tournament_id) {
        results.push({ ...base, created: 0, skipped: 'Sin torneo publicado' });
        continue;
      }
      try {
        const summary = await this.brackets.generate(stage.tournament_id, {
          mode: options.mode,
          reset: !!options.regenerate,
        });
        results.push({
          ...base,
          created: summary.matches,
          mode: summary.mode,
          groups: summary.groups,
          knockoutSize: summary.knockoutSize,
          teams: summary.teams,
        });
        this.realtime.emitTournamentUpdated({
          tournamentId: stage.tournament_id,
          type: 'fixture_generated',
        });
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        const body = e.getResponse() as string | { message?: string | string[] };
        const message = typeof body === 'string' ? body : body.message;
        results.push({
          ...base,
          created: 0,
          skipped: (Array.isArray(message) ? message[0] : message) || e.message,
        });
      }
    }

    const generated = results.filter((r) => r.created > 0);
    if (generated.length) {
      this.realtime.emitCircuitEventUpdated({ circuitId, eventId, type: 'brackets_generated' });
      await this.audit.log(circuitId, userId, {
        action: options.regenerate ? 'brackets.regenerate' : 'brackets.generate',
        entityType: 'circuit_event',
        entityId: eventId,
        summary: `${options.regenerate ? 'Rearmó' : 'Armó'} los cuadros de ${generated.length} categoría(s): ${generated.map((r) => r.categoryLabel ?? 'Torneo').join(', ')}`,
      });
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

    const includeDraft =
      !!filters.includeDraft &&
      (await this.access.can(circuitId, filters.viewerUserId, 'circuit.view_internal'));
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
              tm.phase, tm.group_name,
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
      phase: row.phase as 'GROUP' | 'KNOCKOUT' | null,
      groupName: row.group_name as string | null,
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

    if (publish) {
      await this.notifyPlayersOfSchedule(
        [{ matchId } as ScheduleAssignment],
        circuitId,
        eventId,
        'Cambio de horario de tu partido',
      );
    }
    await this.audit.log(circuitId, userId, {
      action: 'schedule.match',
      entityType: 'tournament_match',
      entityId: matchId,
      summary: `Reprogramó un partido de ${event.name}: ${payload.courtLabel} · ${new Date(payload.scheduledAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
    });

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
              tm.team_a_source, tm.team_b_source, tm.phase, tm.group_name,
              tm.next_match_id, tm.next_slot, tm.round, tm.status, tm.score,
              tm.scheduled_at, tm.club_id, tm.court_label,
              cc.label AS category_label
       FROM tournament_matches tm
       INNER JOIN circuit_stages cs ON cs.tournament_id = tm.tournament_id
       LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
       WHERE cs.event_id = $1
         AND tm.status <> 'CANCELLED'`,
      [eventId],
    );
    const rows = matchesRes.rows;
    const durationMs = duration * 60_000;
    const now = Date.now();

    const isByeLike = (m: any) =>
      !!m.score?.bye || m.team_a_source === BYE_SOURCE || m.team_b_source === BYE_SOURCE;
    const isPlayed = (m: any) =>
      (m.status === 'FINISHED' || m.status === 'IN_PROGRESS') && !isByeLike(m);

    const feedersOf = new Map<string, any[]>();
    const groupMatches = new Map<string, any[]>();
    for (const m of rows) {
      if (m.next_match_id) {
        feedersOf.set(m.next_match_id, [...(feedersOf.get(m.next_match_id) ?? []), m]);
      }
      if (m.phase === 'GROUP') {
        const key = `${m.tournament_id}|${m.group_name}`;
        groupMatches.set(key, [...(groupMatches.get(key) ?? []), m]);
      }
    }

    const regIds = [
      ...new Set(
        rows
          .flatMap((m) => [m.team_a_registration_id, m.team_b_registration_id])
          .filter(Boolean) as string[],
      ),
    ];
    const teamAvail = await this.loadTeamAvailabilities(regIds, dayKeys);

    // Lo ya jugado (o en juego) conserva su cancha y bloquea a sus parejas.
    const courtBusy: Array<{ courtKey: string; start: Date }> = [];
    const teamBusy: Array<{ teamId: string; start: Date }> = [];
    const teamVenues = new Map<string, Set<string>>();
    const assignedEnd = new Map<string, number>();
    for (const m of rows) {
      if (!isPlayed(m) || !m.scheduled_at) continue;
      const start = new Date(m.scheduled_at);
      assignedEnd.set(m.id, start.getTime() + durationMs);
      if (m.club_id && m.court_label) courtBusy.push({ courtKey: `${m.club_id}|${m.court_label}`, start });
      for (const teamId of [m.team_a_registration_id, m.team_b_registration_id].filter(Boolean)) {
        teamBusy.push({ teamId, start });
      }
    }

    /** Hora en que termina un partido; null si todavía no tiene horario asignado. */
    const endOf = (m: any, depth: number): number | null => {
      if (depth > 32) return null;
      if (isByeLike(m)) return readyAt(m, depth + 1);
      const assigned = assignedEnd.get(m.id);
      if (assigned != null) return assigned;
      if (m.status === 'FINISHED' || m.status === 'IN_PROGRESS') return 0;
      return null;
    };
    /** Primer momento en que se conocen las dos parejas (fin de su zona o de los partidos previos). */
    const readyAt = (m: any, depth = 0): number | null => {
      let ready = 0;
      for (const side of ['a', 'b'] as const) {
        if (m[`team_${side}_registration_id`]) continue;
        const source = m[`team_${side}_source`];
        if (source === BYE_SOURCE) continue;
        const parsed = parseGroupSource(source);
        const deps = parsed
          ? groupMatches.get(`${m.tournament_id}|${parsed.group}`) ?? []
          : (feedersOf.get(m.id) ?? []).filter((f) => f.next_slot === side.toUpperCase());
        for (const dep of deps) {
          const end = endOf(dep, depth);
          if (end == null) return null;
          ready = Math.max(ready, end);
        }
      }
      return ready;
    };

    type PendingMatch = {
      row: any;
      id: string;
      tournamentId: string;
      categoryLabel: string | null;
      teamAId: string | null;
      teamBId: string | null;
      knockout: boolean;
      round: number;
      feasibleCount: number;
    };

    const futureSlots = slots.filter((s) => s.startAt.getTime() >= now);
    const coverage = (team: TeamAvailability | undefined, slot: CourtSlot, known: boolean) => {
      if (!known) return { ok: true, score: 0 } as { ok: boolean; score: number; warning?: string };
      return team
        ? teamCoversSlot(team, slot.dayDate, slot.startHour, slot.endHour, slot.clubId, strict)
        : { ok: !strict, score: 5, warning: 'Sin disponibilidad' };
    };

    const pending: PendingMatch[] = rows
      .filter(
        (m) =>
          m.status === 'SCHEDULED' &&
          !isByeLike(m) &&
          (m.phase === 'KNOCKOUT' || (m.team_a_registration_id && m.team_b_registration_id)),
      )
      .map((m) => {
        const a = teamAvail.get(m.team_a_registration_id);
        const b = teamAvail.get(m.team_b_registration_id);
        const feasibleCount = futureSlots.filter(
          (slot) =>
            coverage(a, slot, !!m.team_a_registration_id).ok &&
            coverage(b, slot, !!m.team_b_registration_id).ok,
        ).length;
        return {
          row: m,
          id: m.id,
          tournamentId: m.tournament_id,
          categoryLabel: m.category_label,
          teamAId: m.team_a_registration_id,
          teamBId: m.team_b_registration_id,
          knockout: m.phase === 'KNOCKOUT',
          round: Number(m.round) || 0,
          feasibleCount,
        };
      });

    pending.sort(
      (x, y) =>
        Number(x.knockout) - Number(y.knockout) ||
        (x.knockout ? x.round - y.round : 0) ||
        x.feasibleCount - y.feasibleCount,
    );

    const assignments: ScheduleAssignment[] = [];
    const unassigned: Array<{ matchId: string; tournamentId: string; reason: string }> = [];
    const venuesUsed = new Set<string>();

    for (const match of pending) {
      const earliest = match.knockout ? readyAt(match.row) : 0;
      if (earliest == null) {
        unassigned.push({
          matchId: match.id,
          tournamentId: match.tournamentId,
          reason: 'Depende de partidos de zona o del cuadro que no tienen horario',
        });
        continue;
      }

      const teamA = match.teamAId ? teamAvail.get(match.teamAId) : undefined;
      const teamB = match.teamBId ? teamAvail.get(match.teamBId) : undefined;
      const knownTeams = [match.teamAId, match.teamBId].filter(Boolean) as string[];
      let best: { slot: CourtSlot; score: number; warnings: string[] } | null = null;

      for (const slot of futureSlots) {
        if (slot.startAt.getTime() < earliest) continue;
        const courtKey = `${slot.clubId}|${slot.courtLabel}`;
        if (
          courtBusy.some(
            (c) => c.courtKey === courtKey && rangesOverlap(c.start, durationMs, slot.startAt, durationMs),
          )
        ) {
          continue;
        }
        if (
          teamBusy.some(
            (b) =>
              knownTeams.includes(b.teamId) &&
              rangesOverlap(b.start, durationMs, slot.startAt, durationMs),
          )
        ) {
          continue;
        }

        const ca = coverage(teamA, slot, !!match.teamAId);
        const cb = coverage(teamB, slot, !!match.teamBId);
        if (!ca.ok || !cb.ok) continue;

        let score = ca.score + cb.score;
        if (slot.isPrimary) score += 5;
        if (knownTeams.some((t) => teamVenues.get(t)?.has(slot.clubId))) score += 8;

        const warnings = [ca.warning, cb.warning].filter(Boolean) as string[];
        if (!best || score > best.score) {
          best = { slot, score, warnings };
        }
      }

      if (!best) {
        unassigned.push({
          matchId: match.id,
          tournamentId: match.tournamentId,
          reason: !futureSlots.length
            ? 'El evento no tiene horarios futuros disponibles'
            : strict
              ? 'Sin slot que cumpla disponibilidad y canchas'
              : 'Sin canchas libres en el rango del evento',
        });
        continue;
      }

      courtBusy.push({ courtKey: `${best.slot.clubId}|${best.slot.courtLabel}`, start: best.slot.startAt });
      assignedEnd.set(match.id, best.slot.startAt.getTime() + durationMs);
      for (const teamId of knownTeams) {
        teamBusy.push({ teamId, start: best.slot.startAt });
        teamVenues.set(teamId, (teamVenues.get(teamId) ?? new Set()).add(best.slot.clubId));
      }
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

  /** Solo libera horarios de partidos por jugar: lo jugado o en juego conserva su cancha. */
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
         AND tm.status = 'SCHEDULED'
         AND COALESCE((tm.score->>'bye')::boolean, FALSE) = FALSE
         AND ($2::boolean = FALSE OR tm.schedule_published = FALSE)`,
      [eventId, keepUnpublishedOnly],
    );
  }

  private async notifyPlayersOfSchedule(
    assignments: ScheduleAssignment[],
    circuitId: string,
    eventId: string,
    title = 'Horario de tu partido',
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
          title,
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
    await this.access.assert(
      circuitId,
      userId,
      'circuit.schedule',
      'Solo el Presidente, un Organizador o un Fiscal del circuito pueden gestionar la grilla',
    );
  }
}
