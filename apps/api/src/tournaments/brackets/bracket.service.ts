import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  BYE_SOURCE,
  applyZoneDraft,
  FIXTURE_MODES,
  MIN_TEAMS_FOR_GROUPS,
  QUALIFIERS_PER_GROUP,
  computeGroupStandings,
  formatToMode,
  groupQualifierEntrants,
  knockoutRoundLabel,
  parseGroupSource,
  placeEntrants,
  planGroups,
  rankTeams,
  roundRobinRounds,
  sourceLabel,
  teamEntrants,
  validateSets,
  type BracketTeam,
  type FixtureMode,
  type GroupPlan,
  type GroupMatchResult,
  type KnockoutEntrant,
  type SetScore,
} from './bracket-engine';

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

type Side = { registrationId: string | null; name: string | null; source: string | null };

type NewMatch = {
  tournamentId: string;
  round: number;
  roundLabel: string;
  phase?: 'GROUP' | 'KNOCKOUT' | null;
  groupName?: string | null;
  courtLabel?: string | null;
  bracketPosition?: number | null;
  nextMatchId?: string | null;
  nextSlot?: 'A' | 'B' | null;
  a: Side;
  b: Side;
};

export type GenerateFixtureOptions = {
  mode?: FixtureMode;
  reset?: boolean;
  force?: boolean;
};

export type GenerateFixtureSummary = {
  mode: FixtureMode;
  teams: number;
  matches: number;
  groups: number;
  knockoutSize: number;
};

export type RecordResultInput = {
  sets?: SetScore[];
  walkoverWinner?: 'A' | 'B';
};

const EMPTY_SIDE: Side = { registrationId: null, name: null, source: null };

/** El rating de los jugadores solo desempata: nunca supera un punto de ranking del circuito. */
const RATING_CAP = 100_000;

const PLAYED_SQL = `(status = 'IN_PROGRESS'
  OR (status = 'FINISHED' AND COALESCE((score->>'bye')::boolean, FALSE) = FALSE))`;

@Injectable()
export class BracketService {
  private readonly logger = new Logger(BracketService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Generación
  // ---------------------------------------------------------------------------

  async generate(
    tournamentId: string,
    options: GenerateFixtureOptions = {},
  ): Promise<GenerateFixtureSummary> {
    const summary = await this.generateInTransaction(tournamentId, options);
    await this.notifyDefinedRivals(tournamentId);
    return summary;
  }

  private async generateInTransaction(
    tournamentId: string,
    options: GenerateFixtureOptions,
  ): Promise<GenerateFixtureSummary> {
    return this.db.transaction(async (client) => {
      const tournament = await this.lockTournament(client, tournamentId);
      const requested = options.mode ?? formatToMode(tournament.format);
      if (!FIXTURE_MODES.includes(requested)) {
        throw new BadRequestException('Modo de fixture no soportado');
      }

      const existing = await client.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE ${PLAYED_SQL})::int AS played
         FROM tournament_matches WHERE tournament_id = $1`,
        [tournamentId],
      );
      const total = Number(existing.rows[0]?.total ?? 0);
      const played = Number(existing.rows[0]?.played ?? 0);
      if (total > 0 && !options.reset) {
        throw new ConflictException({
          message: 'El torneo ya tiene fixture. Regeneralo si querés rearmarlo.',
          code: 'FIXTURE_EXISTS',
        });
      }
      if (played > 0 && !options.force) {
        throw new ConflictException({
          message: `Ya hay ${played} partido(s) con resultado cargado. Si regenerás el fixture se pierden.`,
          code: 'FIXTURE_HAS_RESULTS',
          played,
        });
      }

      const teams = rankTeams(await this.loadTeams(client, tournament));
      if (teams.length < 2) {
        throw new BadRequestException('Se necesitan al menos 2 parejas aprobadas');
      }

      if (total > 0) await this.deleteMatches(client, tournamentId);

      let mode = requested;
      if (mode === 'GROUPS_THEN_ELIMINATION' && teams.length < MIN_TEAMS_FOR_GROUPS) {
        mode = 'SINGLE_ELIMINATION';
      }

      const summary: GenerateFixtureSummary = {
        mode,
        teams: teams.length,
        matches: 0,
        groups: 0,
        knockoutSize: 0,
      };

      if (mode === 'GROUPS_THEN_ELIMINATION') {
        const groups = await this.planZones(client, tournamentId, teams);
        let groupRounds = 0;
        for (const group of groups) {
          const rounds = roundRobinRounds(group.teams);
          groupRounds = Math.max(groupRounds, rounds.length);
          for (const [idx, pairs] of rounds.entries()) {
            for (const [a, b] of pairs) {
              await this.insertMatch(client, {
                tournamentId,
                round: idx + 1,
                roundLabel: `Zona ${group.code} · Fecha ${idx + 1}`,
                phase: 'GROUP',
                groupName: group.code,
                a: teamSide(a),
                b: teamSide(b),
              });
              summary.matches++;
            }
          }
        }
        const slots = placeEntrants(groupQualifierEntrants(groups));
        summary.matches += await this.insertKnockout(client, tournamentId, slots, groupRounds);
        summary.groups = groups.length;
        summary.knockoutSize = slots.length;
      } else if (mode === 'SINGLE_ELIMINATION') {
        const slots = placeEntrants(teamEntrants(teams));
        summary.matches = await this.insertKnockout(client, tournamentId, slots, 0);
        summary.knockoutSize = slots.length;
      } else if (mode === 'ROUND_ROBIN') {
        const internal = tournament.modality === 'INTERNAL';
        let sequence = 1;
        for (const [idx, pairs] of roundRobinRounds(teams).entries()) {
          for (const [a, b] of pairs) {
            await this.insertMatch(client, {
              tournamentId,
              round: internal ? sequence : idx + 1,
              roundLabel: internal ? `Partido ${sequence}` : `Fecha ${idx + 1}`,
              a: teamSide(a),
              b: teamSide(b),
            });
            sequence++;
            summary.matches++;
          }
        }
      } else {
        const courts = Math.max(1, Number(tournament.courts_available) || 2);
        let globalRound = 1;
        for (const [idx, pairs] of roundRobinRounds(teams).entries()) {
          for (let offset = 0; offset < pairs.length; offset += courts) {
            const batch = pairs.slice(offset, offset + courts);
            const sub = pairs.length > courts ? `.${Math.floor(offset / courts) + 1}` : '';
            for (const [courtIdx, [a, b]] of batch.entries()) {
              await this.insertMatch(client, {
                tournamentId,
                round: globalRound,
                roundLabel: `Turno ${idx + 1}${sub}`,
                courtLabel: `Cancha ${courtIdx + 1}`,
                a: teamSide(a),
                b: teamSide(b),
              });
              summary.matches++;
            }
            globalRound++;
          }
        }
      }

      await this.autoResolveByes(client, tournamentId);
      await client.query(
        `UPDATE tournaments SET status = 'IN_PROGRESS', updated_at = NOW()
         WHERE id = $1
           AND (status = 'OPEN_REGISTRATION' OR (status = 'DRAFT' AND modality = 'INTERNAL'))`,
        [tournamentId],
      );
      return summary;
    });
  }

  async clearFixture(tournamentId: string) {
    await this.db.transaction(async (client) => {
      await this.lockTournament(client, tournamentId);
      await this.deleteMatches(client, tournamentId);
    });
  }

  // ---------------------------------------------------------------------------
  // Zonas: borrador editable y cierre manual
  // ---------------------------------------------------------------------------

  /** Zonas propuestas (o guardadas por el organizador) antes de generar los partidos. */
  async getZoneDraft(tournamentId: string) {
    const tournament = await this.loadTournament(this.db, tournamentId);
    const teams = rankTeams(await this.loadTeams(this.db, tournament));
    const saved = await this.db.query(
      `SELECT 1 FROM tournament_group_entries WHERE tournament_id = $1 LIMIT 1`,
      [tournamentId],
    );
    const fixture = await this.db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE phase = 'GROUP')::int AS group_matches,
              COUNT(*) FILTER (WHERE ${PLAYED_SQL})::int AS played
       FROM tournament_matches WHERE tournament_id = $1`,
      [tournamentId],
    );
    let groups: GroupPlan[] = [];
    let error: string | null = null;
    if (Number(fixture.rows[0]?.group_matches ?? 0) > 0) {
      groups = await this.groupsFromMatches(tournamentId, teams);
    } else if (teams.length >= 2) {
      try {
        groups = await this.planZones(this.db, tournamentId, teams);
      } catch (e) {
        error = (e as Error).message;
        groups = planGroups(teams);
      }
    }
    const seedById = new Map(teams.map((t, i) => [t.id, i + 1]));
    return {
      saved: !!saved.rows[0],
      teams: teams.length,
      fixtureMatches: Number(fixture.rows[0]?.total ?? 0),
      groupMatches: Number(fixture.rows[0]?.group_matches ?? 0),
      playedMatches: Number(fixture.rows[0]?.played ?? 0),
      error,
      groups: groups.map((g) => ({
        code: g.code,
        teams: g.teams.map((t) => ({ id: t.id, name: t.name, seed: seedById.get(t.id) ?? null })),
      })),
    };
  }

  /**
   * Guarda las zonas armadas a mano. Si el fixture ya existe solo se permite mientras
   * no haya resultados, y los partidos se regeneran con las zonas nuevas.
   */
  async saveZoneDraft(tournamentId: string, zones: Array<{ code: string; teamIds: string[] }>) {
    await this.db.transaction(async (client) => {
      const tournament = await this.lockTournament(client, tournamentId);
      const approved = new Set((await this.loadTeams(client, tournament)).map((t) => t.id));
      const seen = new Set<string>();
      for (const zone of zones) {
        for (const id of zone.teamIds) {
          if (!approved.has(id)) {
            throw new BadRequestException('Hay parejas que no están aprobadas en este torneo');
          }
          if (seen.has(id)) throw new BadRequestException('Una pareja aparece en dos zonas');
          seen.add(id);
        }
      }
      await this.assertNoGroupFixture(client, tournamentId);
      const draft = zones.flatMap((zone) =>
        zone.teamIds.map((teamId, slot) => ({ teamId, group: zone.code, slot })),
      );
      const ranked = rankTeams(await this.loadTeams(client, tournament));
      let groups: GroupPlan[];
      try {
        groups = applyZoneDraft(ranked, draft);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      await this.saveDraftRows(client, tournamentId, groups);
    });
    return this.getZoneDraft(tournamentId);
  }

  async resetZoneDraft(tournamentId: string) {
    await this.db.transaction(async (client) => {
      await this.lockTournament(client, tournamentId);
      await this.assertNoGroupFixture(client, tournamentId);
      await client.query(`DELETE FROM tournament_group_entries WHERE tournament_id = $1`, [
        tournamentId,
      ]);
    });
    return this.getZoneDraft(tournamentId);
  }

  /**
   * "Cerrar zona": los partidos sin jugar se cancelan y la tabla queda definitiva con lo
   * jugado (sin partidos, por siembra). Los clasificados pasan al cuadro.
   */
  async closeGroup(tournamentId: string, code: string) {
    const result = await this.db.transaction(async (client) => {
      const tournament = await this.lockTournament(client, tournamentId);
      const rows = await client.query(
        `SELECT id, status FROM tournament_matches
         WHERE tournament_id = $1 AND phase = 'GROUP' AND group_name = $2`,
        [tournamentId, code],
      );
      if (!rows.rows.length) throw new NotFoundException(`No existe la Zona ${code}`);
      const cancelled = await client.query(
        `UPDATE tournament_matches
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE tournament_id = $1 AND phase = 'GROUP' AND group_name = $2
           AND status IN ('SCHEDULED', 'IN_PROGRESS')
         RETURNING id`,
        [tournamentId, code],
      );
      await this.resolveGroup(client, tournament, code);
      return { code, cancelled: cancelled.rows.length };
    });
    await this.notifyDefinedRivals(tournamentId);
    return result;
  }

  /** Vuelve a habilitar los partidos cancelados al cerrar la zona. */
  async reopenGroup(tournamentId: string, code: string) {
    return this.db.transaction(async (client) => {
      const tournament = await this.lockTournament(client, tournamentId);
      await this.assertGroupDependentsOpen(client, tournamentId, code);
      const reopened = await client.query(
        `UPDATE tournament_matches
         SET status = 'SCHEDULED', updated_at = NOW()
         WHERE tournament_id = $1 AND phase = 'GROUP' AND group_name = $2 AND status = 'CANCELLED'
         RETURNING id`,
        [tournamentId, code],
      );
      await this.resolveGroup(client, tournament, code);
      return { code, reopened: reopened.rows.length };
    });
  }

  /**
   * Avisa a las parejas de los partidos de cuadro que ya tienen rival definido.
   * Si el cruce cambia (corrección de resultados) se vuelve a avisar.
   */
  async notifyDefinedRivals(tournamentId: string) {
    const ready = await this.db.query(
      `UPDATE tournament_matches tm
       SET rival_notified_key = tm.team_a_registration_id::text || '|' || tm.team_b_registration_id::text
       FROM tournaments t
       WHERE tm.tournament_id = $1 AND t.id = tm.tournament_id
         AND t.status = 'IN_PROGRESS'
         AND tm.phase = 'KNOCKOUT' AND tm.status = 'SCHEDULED'
         AND tm.team_a_registration_id IS NOT NULL AND tm.team_b_registration_id IS NOT NULL
         AND tm.rival_notified_key IS DISTINCT FROM
             (tm.team_a_registration_id::text || '|' || tm.team_b_registration_id::text)
       RETURNING tm.id, tm.round_label, tm.team_a_registration_id, tm.team_b_registration_id,
                 tm.team_a_name, tm.team_b_name, tm.scheduled_at, tm.schedule_published,
                 t.name AS tournament_name, t.circuit_id`,
      [tournamentId],
    );
    if (!ready.rows.length) return 0;

    const regIds = ready.rows.flatMap((m) => [m.team_a_registration_id, m.team_b_registration_id]);
    const regs = await this.db.query(
      `SELECT id, player1_user_id, player2_user_id FROM tournament_registrations WHERE id = ANY($1::uuid[])`,
      [regIds],
    );
    const usersByReg = new Map<string, string[]>(
      regs.rows.map((r) => [r.id, [r.player1_user_id, r.player2_user_id].filter(Boolean)]),
    );

    const payloads: Array<{ userId: string; type: string; title: string; body: string; data: any }> = [];
    for (const m of ready.rows) {
      const when =
        m.scheduled_at && m.schedule_published
          ? ` · ${new Date(m.scheduled_at).toLocaleString('es-AR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : ' · Horario a definir';
      for (const [regId, rival] of [
        [m.team_a_registration_id, m.team_b_name],
        [m.team_b_registration_id, m.team_a_name],
      ] as const) {
        for (const userId of usersByReg.get(regId) ?? []) {
          payloads.push({
            userId,
            type: 'tournament_rival',
            title: `${m.round_label || 'Próximo partido'}: ya tenés rival`,
            body: `${m.tournament_name}: contra ${rival || 'pareja a definir'}${when}`,
            data: { tournamentId, matchId: m.id, circuitId: m.circuit_id ?? undefined },
          });
        }
      }
    }
    try {
      await this.notifications.createMany(payloads);
    } catch (error) {
      this.logger.warn(`No se pudieron enviar avisos de rival: ${(error as Error).message}`);
    }
    return ready.rows.length;
  }

  // ---------------------------------------------------------------------------
  // Resultados
  // ---------------------------------------------------------------------------

  async recordResult(tournamentId: string, matchId: string, input: RecordResultInput) {
    const saved = await this.db.transaction(async (client) => {
      const tournament = await this.lockTournament(client, tournamentId);
      const match = await this.getMatch(client, tournamentId, matchId);
      if (match.status === 'CANCELLED') throw new BadRequestException('El partido está cancelado');
      if (match.score?.bye) {
        throw new BadRequestException('Es un pase libre (BYE): no lleva resultado');
      }
      if (!match.team_a_registration_id || !match.team_b_registration_id) {
        throw new BadRequestException('Todavía no están definidas las dos parejas de este partido');
      }

      let score: Record<string, unknown>;
      let winnerSide: 'A' | 'B';
      if (input.walkoverWinner) {
        winnerSide = input.walkoverWinner;
        score = {
          sets: [],
          setsA: winnerSide === 'A' ? 2 : 0,
          setsB: winnerSide === 'B' ? 2 : 0,
          walkover: true,
        };
      } else {
        let totals: { setsA: number; setsB: number };
        try {
          totals = validateSets(input.sets);
        } catch (e) {
          throw new BadRequestException((e as Error).message);
        }
        winnerSide = totals.setsA > totals.setsB ? 'A' : 'B';
        score = {
          sets: input.sets!.map((s) => ({ teamA: Number(s.teamA), teamB: Number(s.teamB) })),
          ...totals,
        };
      }

      const winnerId =
        winnerSide === 'A' ? match.team_a_registration_id : match.team_b_registration_id;
      const previousWinner = match.status === 'FINISHED' ? match.winner_registration_id : null;

      if (match.phase === 'GROUP') {
        await this.assertGroupDependentsOpen(client, tournamentId, match.group_name);
      } else if (previousWinner && previousWinner !== winnerId) {
        await this.assertNextMatchOpen(client, match);
      }

      await client.query(
        `UPDATE tournament_matches
         SET score = $2::jsonb, status = 'FINISHED',
             finished_at = COALESCE(finished_at, NOW()),
             winner_registration_id = $3, updated_at = NOW()
         WHERE id = $1`,
        [matchId, JSON.stringify(score), winnerId],
      );

      if (match.phase === 'GROUP') {
        await this.resolveGroup(client, tournament, match.group_name);
      } else {
        await this.advance(client, match, winnerId);
      }
      return this.getMatch(client, tournamentId, matchId);
    });
    await this.notifyDefinedRivals(tournamentId);
    return saved;
  }

  async clearResult(tournamentId: string, matchId: string) {
    return this.db.transaction(async (client) => {
      const tournament = await this.lockTournament(client, tournamentId);
      const match = await this.getMatch(client, tournamentId, matchId);
      if (match.score?.bye) {
        throw new BadRequestException('Es un pase libre (BYE): se resuelve solo');
      }
      if (match.status !== 'FINISHED') return match;

      if (match.phase === 'GROUP') {
        await this.assertGroupDependentsOpen(client, tournamentId, match.group_name);
      } else {
        await this.assertNextMatchOpen(client, match);
      }

      await client.query(
        `UPDATE tournament_matches
         SET score = NULL, status = 'SCHEDULED', finished_at = NULL,
             winner_registration_id = NULL, updated_at = NOW()
         WHERE id = $1`,
        [matchId],
      );

      if (match.phase === 'GROUP') {
        await this.resolveGroup(client, tournament, match.group_name);
      } else {
        await this.retract(client, match);
      }
      return this.getMatch(client, tournamentId, matchId);
    });
  }

  /** Partidos del cuadro que no se pueden borrar sueltos sin romper el árbol. */
  assertMatchRemovable(match: { phase?: string | null }) {
    if (match.phase) {
      throw new BadRequestException(
        'Los partidos de zonas y cuadro no se borran sueltos: regenerá el fixture.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  async getGroups(tournamentId: string) {
    const tournament = await this.loadTournament(this.db, tournamentId);
    const matches = await this.db.query(
      `SELECT * FROM tournament_matches
       WHERE tournament_id = $1 AND phase = 'GROUP'
       ORDER BY group_name ASC, round ASC, created_at ASC`,
      [tournamentId],
    );
    const teams = rankTeams(await this.loadTeams(this.db, tournament));
    const nameById = new Map(teams.map((t) => [t.id, t.name]));
    const seedOrder = teams.map((t) => t.id);

    const byGroup = new Map<string, any[]>();
    for (const m of matches.rows) {
      const list = byGroup.get(m.group_name) ?? [];
      list.push(m);
      byGroup.set(m.group_name, list);
    }

    const groups = [...byGroup.entries()].map(([code, rows]) => {
      const standings = computeGroupStandings(teamIdsOf(rows, seedOrder), groupResults(rows));
      return {
        code,
        complete: isGroupComplete(rows),
        closedManually: rows.some((m) => m.status === 'CANCELLED'),
        played: rows.filter((m) => m.status === 'FINISHED').length,
        total: rows.length,
        standings: standings.map((row) => ({
          ...row,
          teamName: nameById.get(row.registrationId) ?? 'Pareja',
          qualified: row.position <= QUALIFIERS_PER_GROUP,
        })),
        matches: rows,
      };
    });

    return { qualifiersPerGroup: QUALIFIERS_PER_GROUP, groups };
  }

  /** Tabla general para fixtures sin zonas (todos contra todos, cancha abierta). */
  async getLeagueStandings(tournamentId: string) {
    const tournament = await this.loadTournament(this.db, tournamentId);
    const teams = rankTeams(await this.loadTeams(this.db, tournament));
    const matches = await this.db.query(
      `SELECT * FROM tournament_matches
       WHERE tournament_id = $1 AND status = 'FINISHED'
         AND (phase IS NULL OR phase = 'GROUP')`,
      [tournamentId],
    );
    const nameById = new Map(teams.map((t) => [t.id, t.name]));
    return computeGroupStandings(
      teams.map((t) => t.id),
      groupResults(matches.rows),
    ).map((row) => ({ ...row, teamName: nameById.get(row.registrationId) ?? 'Pareja' }));
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async insertKnockout(
    client: PoolClient,
    tournamentId: string,
    slots: Array<KnockoutEntrant | null>,
    roundOffset: number,
  ): Promise<number> {
    const size = slots.length;
    const totalRounds = Math.log2(size);
    const idsByRound: string[][] = [];
    let inserted = 0;

    for (let round = totalRounds; round >= 1; round--) {
      idsByRound[round] = [];
      const count = size / Math.pow(2, round);
      for (let i = 0; i < count; i++) {
        const isLast = round === totalRounds;
        const id = await this.insertMatch(client, {
          tournamentId,
          round: roundOffset + round,
          roundLabel: knockoutRoundLabel(round, totalRounds),
          phase: 'KNOCKOUT',
          bracketPosition: i,
          nextMatchId: isLast ? null : idsByRound[round + 1][Math.floor(i / 2)],
          nextSlot: isLast ? null : i % 2 === 0 ? 'A' : 'B',
          a: round === 1 ? entrantSide(slots[i * 2]) : EMPTY_SIDE,
          b: round === 1 ? entrantSide(slots[i * 2 + 1]) : EMPTY_SIDE,
        });
        idsByRound[round].push(id);
        inserted++;
      }
    }
    return inserted;
  }

  private async insertMatch(client: PoolClient, m: NewMatch): Promise<string> {
    const result = await client.query(
      `INSERT INTO tournament_matches
        (tournament_id, round, round_label, phase, group_name, court_label,
         bracket_position, next_match_id, next_slot,
         team_a_registration_id, team_b_registration_id, team_a_name, team_b_name,
         team_a_source, team_b_source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'SCHEDULED')
       RETURNING id`,
      [
        m.tournamentId,
        m.round,
        m.roundLabel,
        m.phase ?? null,
        m.groupName ?? null,
        m.courtLabel ?? null,
        m.bracketPosition ?? null,
        m.nextMatchId ?? null,
        m.nextSlot ?? null,
        m.a.registrationId,
        m.b.registrationId,
        m.a.name,
        m.b.name,
        m.a.source,
        m.b.source,
      ],
    );
    return result.rows[0].id;
  }

  private async deleteMatches(client: PoolClient, tournamentId: string) {
    await client.query(
      `UPDATE tournament_matches SET next_match_id = NULL WHERE tournament_id = $1`,
      [tournamentId],
    );
    await client.query(`DELETE FROM tournament_matches WHERE tournament_id = $1`, [tournamentId]);
  }

  /** Cierra los partidos contra BYE en cuanto se conoce la pareja que pasa. */
  private async autoResolveByes(client: PoolClient, tournamentId: string) {
    for (let pass = 0; pass < 8; pass++) {
      const pending = await client.query(
        `SELECT * FROM tournament_matches
         WHERE tournament_id = $1 AND phase = 'KNOCKOUT' AND status = 'SCHEDULED'
           AND ((team_b_source = $2 AND team_a_registration_id IS NOT NULL)
             OR (team_a_source = $2 AND team_b_registration_id IS NOT NULL))`,
        [tournamentId, BYE_SOURCE],
      );
      if (!pending.rows.length) return;
      for (const m of pending.rows) {
        const winnerIsA = m.team_b_source === BYE_SOURCE;
        const winnerId = winnerIsA ? m.team_a_registration_id : m.team_b_registration_id;
        await client.query(
          `UPDATE tournament_matches
           SET status = 'FINISHED', finished_at = NOW(), winner_registration_id = $2,
               score = $3::jsonb, updated_at = NOW()
           WHERE id = $1`,
          [
            m.id,
            winnerId,
            JSON.stringify({ sets: [], setsA: winnerIsA ? 1 : 0, setsB: winnerIsA ? 0 : 1, bye: true }),
          ],
        );
        await this.advance(client, m, winnerId);
      }
    }
  }

  private async advance(client: PoolClient, match: any, winnerId: string) {
    if (!match.next_match_id || !match.next_slot) return;
    const side = match.next_slot === 'A' ? 'a' : 'b';
    await client.query(
      `UPDATE tournament_matches
       SET team_${side}_registration_id = $2, team_${side}_name = $3, updated_at = NOW()
       WHERE id = $1`,
      [match.next_match_id, winnerId, await this.registrationName(client, winnerId)],
    );
  }

  private async retract(client: PoolClient, match: any) {
    if (!match.next_match_id || !match.next_slot) return;
    const side = match.next_slot === 'A' ? 'a' : 'b';
    await client.query(
      `UPDATE tournament_matches
       SET team_${side}_registration_id = NULL, team_${side}_name = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'SCHEDULED'`,
      [match.next_match_id],
    );
  }

  private async assertNextMatchOpen(client: PoolClient, match: any) {
    if (!match.next_match_id) return;
    const next = await client.query(
      `SELECT round_label FROM tournament_matches WHERE id = $1 AND ${PLAYED_SQL}`,
      [match.next_match_id],
    );
    if (next.rows[0]) {
      throw new ConflictException(
        `Ya se jugó el partido siguiente (${next.rows[0].round_label || 'próxima ronda'}). ` +
          'Borrá primero ese resultado para cambiar quién pasa.',
      );
    }
  }

  /** Una zona no se puede corregir si alguno de sus clasificados ya jugó en el cuadro. */
  private async assertGroupDependentsOpen(client: PoolClient, tournamentId: string, code: string) {
    const fed = await client.query(
      `SELECT id, round_label, status, score, next_match_id FROM tournament_matches
       WHERE tournament_id = $1 AND phase = 'KNOCKOUT'
         AND (team_a_source LIKE $2 OR team_b_source LIKE $2)`,
      [tournamentId, `GROUP:${code}:%`],
    );
    for (const m of fed.rows) {
      const played = m.status === 'IN_PROGRESS' || (m.status === 'FINISHED' && !m.score?.bye);
      if (played) throw this.groupLockedError(code, m.round_label);
      if (m.score?.bye) {
        const next = await client.query(
          `SELECT round_label FROM tournament_matches WHERE id = $1 AND ${PLAYED_SQL}`,
          [m.next_match_id],
        );
        if (next.rows[0]) throw this.groupLockedError(code, next.rows[0].round_label);
      }
    }
  }

  private groupLockedError(code: string, roundLabel?: string | null) {
    return new ConflictException(
      `Los clasificados de la Zona ${code} ya jugaron en el cuadro (${roundLabel || 'eliminatoria'}). ` +
        'Borrá primero esos resultados para corregir la zona.',
    );
  }

  /**
   * Recalcula la zona y completa (o vacía) los lugares del cuadro que dependen de ella.
   * Los pases libres que salían de la zona se rehacen con los clasificados vigentes.
   */
  private async resolveGroup(client: PoolClient, tournament: any, code: string) {
    const tournamentId = tournament.id;
    const fed = await client.query(
      `SELECT * FROM tournament_matches
       WHERE tournament_id = $1 AND phase = 'KNOCKOUT'
         AND (team_a_source LIKE $2 OR team_b_source LIKE $2)`,
      [tournamentId, `GROUP:${code}:%`],
    );
    if (!fed.rows.length) return;

    for (const m of fed.rows) {
      if (m.status === 'FINISHED' && m.score?.bye) {
        await this.retract(client, m);
        await client.query(
          `UPDATE tournament_matches
           SET status = 'SCHEDULED', finished_at = NULL, winner_registration_id = NULL,
               score = NULL, updated_at = NOW()
           WHERE id = $1`,
          [m.id],
        );
      }
    }

    const groupMatches = await client.query(
      `SELECT * FROM tournament_matches
       WHERE tournament_id = $1 AND phase = 'GROUP' AND group_name = $2`,
      [tournamentId, code],
    );
    const complete = isGroupComplete(groupMatches.rows);

    let standings: Array<{ registrationId: string }> = [];
    if (complete) {
      const seedOrder = rankTeams(await this.loadTeams(client, tournament)).map((t) => t.id);
      standings = computeGroupStandings(
        teamIdsOf(groupMatches.rows, seedOrder),
        groupResults(groupMatches.rows),
      );
    }

    for (const m of fed.rows) {
      for (const side of ['a', 'b'] as const) {
        const source = m[`team_${side}_source`];
        const parsed = parseGroupSource(source);
        if (!parsed || parsed.group !== code) continue;
        const regId = complete ? standings[parsed.position - 1]?.registrationId ?? null : null;
        const name = regId ? await this.registrationName(client, regId) : sourceLabel(source);
        await client.query(
          `UPDATE tournament_matches
           SET team_${side}_registration_id = $2, team_${side}_name = $3, updated_at = NOW()
           WHERE id = $1`,
          [m.id, regId, name],
        );
      }
    }

    await this.autoResolveByes(client, tournamentId);
  }

  /**
   * Parejas aprobadas con su puntaje de siembra: primero el ranking del circuito en la
   * categoría (suma de ambos jugadores) y, como desempate, el rating de los jugadores.
   */
  private async loadTeams(q: Queryable, tournament: any): Promise<BracketTeam[]> {
    const regs = await q.query(
      `SELECT r.id, r.player1_name, r.player2_name, r.player1_user_id, r.player2_user_id,
              COALESCE(p1.rating, 0)::float AS rating1, COALESCE(p2.rating, 0)::float AS rating2
       FROM tournament_registrations r
       LEFT JOIN players p1 ON p1.user_id = r.player1_user_id
       LEFT JOIN players p2 ON p2.user_id = r.player2_user_id
       WHERE r.tournament_id = $1 AND r.status = 'APPROVED'
       ORDER BY r.created_at ASC, r.id ASC`,
      [tournament.id],
    );

    const circuitPoints = new Map<string, number>();
    if (tournament.circuit_id && tournament.circuit_category_id) {
      const userIds = [
        ...new Set(
          regs.rows.flatMap((r) => [r.player1_user_id, r.player2_user_id]).filter(Boolean),
        ),
      ];
      if (userIds.length) {
        const ranking = await q.query(
          `SELECT p.user_id, cr.points
           FROM circuit_rankings cr
           INNER JOIN players p ON p.id = cr.player_id
           WHERE cr.circuit_id = $1 AND cr.category_id = $2 AND p.user_id = ANY($3::uuid[])`,
          [tournament.circuit_id, tournament.circuit_category_id, userIds],
        );
        for (const row of ranking.rows) circuitPoints.set(row.user_id, Number(row.points) || 0);
      }
    }

    return regs.rows.map((r, order) => {
      const points =
        (circuitPoints.get(r.player1_user_id) ?? 0) + (circuitPoints.get(r.player2_user_id) ?? 0);
      const rating = Math.min(Number(r.rating1) + Number(r.rating2), RATING_CAP);
      return {
        id: r.id,
        name: `${r.player1_name} / ${r.player2_name}`,
        seedPoints: points * RATING_CAP + rating,
        order,
      };
    });
  }

  private async planZones(q: Queryable, tournamentId: string, ranked: BracketTeam[]) {
    const draft = await q.query(
      `SELECT registration_id, group_name, slot FROM tournament_group_entries WHERE tournament_id = $1`,
      [tournamentId],
    );
    if (!draft.rows.length) return planGroups(ranked);
    return applyZoneDraft(
      ranked,
      draft.rows.map((r) => ({ teamId: r.registration_id, group: r.group_name, slot: Number(r.slot) })),
    );
  }

  private async groupsFromMatches(tournamentId: string, ranked: BracketTeam[]): Promise<GroupPlan[]> {
    const rows = await this.db.query(
      `SELECT group_name, team_a_registration_id, team_b_registration_id
       FROM tournament_matches WHERE tournament_id = $1 AND phase = 'GROUP'
       ORDER BY group_name`,
      [tournamentId],
    );
    const byId = new Map(ranked.map((t) => [t.id, t]));
    const seedOrder = ranked.map((t) => t.id);
    const byGroup = new Map<string, any[]>();
    for (const row of rows.rows) {
      const list = byGroup.get(row.group_name) ?? [];
      list.push(row);
      byGroup.set(row.group_name, list);
    }
    return [...byGroup.entries()]
      .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
      .map(([code, list]) => ({
        code,
        teams: teamIdsOf(list, seedOrder)
          .map((id) => byId.get(id))
          .filter((t): t is BracketTeam => !!t),
      }));
  }

  private async saveDraftRows(client: PoolClient, tournamentId: string, groups: GroupPlan[]) {
    await client.query(`DELETE FROM tournament_group_entries WHERE tournament_id = $1`, [tournamentId]);
    for (const group of groups) {
      for (const [slot, team] of group.teams.entries()) {
        await client.query(
          `INSERT INTO tournament_group_entries (tournament_id, registration_id, group_name, slot)
           VALUES ($1, $2, $3, $4)`,
          [tournamentId, team.id, group.code, slot],
        );
      }
    }
  }

  /** Las zonas se editan antes de generar los partidos de zona (o regenerando sin resultados). */
  private async assertNoGroupFixture(client: PoolClient, tournamentId: string) {
    const existing = await client.query(
      `SELECT COUNT(*)::int AS total FROM tournament_matches
       WHERE tournament_id = $1 AND phase = 'GROUP'`,
      [tournamentId],
    );
    if (Number(existing.rows[0]?.total ?? 0) > 0) {
      throw new ConflictException({
        message:
          'Los partidos de zona ya están generados. Borrá el fixture (o regeneralo) para cambiar las zonas.',
        code: 'FIXTURE_EXISTS',
      });
    }
  }

  private async lockTournament(client: PoolClient, tournamentId: string) {
    const result = await client.query(`SELECT * FROM tournaments WHERE id = $1 FOR UPDATE`, [
      tournamentId,
    ]);
    if (!result.rows[0]) throw new NotFoundException('Torneo no encontrado');
    return result.rows[0];
  }

  private async loadTournament(q: Queryable, tournamentId: string) {
    const result = await q.query(`SELECT * FROM tournaments WHERE id = $1`, [tournamentId]);
    if (!result.rows[0]) throw new NotFoundException('Torneo no encontrado');
    return result.rows[0];
  }

  private async getMatch(client: PoolClient, tournamentId: string, matchId: string) {
    const result = await client.query(
      `SELECT * FROM tournament_matches WHERE id = $1 AND tournament_id = $2`,
      [matchId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Partido no encontrado');
    return result.rows[0];
  }

  private async registrationName(client: PoolClient, regId: string): Promise<string | null> {
    const result = await client.query(
      `SELECT player1_name, player2_name FROM tournament_registrations WHERE id = $1`,
      [regId],
    );
    const r = result.rows[0];
    return r ? `${r.player1_name} / ${r.player2_name}` : null;
  }
}

function teamSide(team: BracketTeam): Side {
  return { registrationId: team.id, name: team.name, source: null };
}

function entrantSide(entrant: KnockoutEntrant | null): Side {
  if (!entrant) return { registrationId: null, name: 'BYE', source: BYE_SOURCE };
  return {
    registrationId: entrant.team?.id ?? null,
    name: entrant.team?.name ?? entrant.label,
    source: entrant.source,
  };
}

function groupResults(rows: any[]): GroupMatchResult[] {
  return rows
    .filter((m) => m.status === 'FINISHED' && m.team_a_registration_id && m.team_b_registration_id)
    .map((m) => ({
      teamA: m.team_a_registration_id,
      teamB: m.team_b_registration_id,
      winner: m.winner_registration_id,
      sets: Array.isArray(m.score?.sets) ? m.score.sets : [],
      walkover: !!m.score?.walkover,
    }));
}

/** Zona terminada: todos los partidos jugados o cancelados al cerrarla a mano. */
function isGroupComplete(rows: any[]): boolean {
  return rows.length > 0 && rows.every((m) => m.status === 'FINISHED' || m.status === 'CANCELLED');
}

function teamIdsOf(rows: any[], seedOrder: string[]): string[] {
  const ids = new Set<string>();
  for (const m of rows) {
    if (m.team_a_registration_id) ids.add(m.team_a_registration_id);
    if (m.team_b_registration_id) ids.add(m.team_b_registration_id);
  }
  const index = new Map(seedOrder.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => (index.get(a) ?? 1e9) - (index.get(b) ?? 1e9));
}
