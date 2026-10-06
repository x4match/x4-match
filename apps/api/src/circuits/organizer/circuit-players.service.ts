import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CircuitAccessService } from '../circuit-access.service';
import {
  ApplyLevelChangesDto,
  CreateCircuitPlayerDto,
  SetCircuitPlayerLevelDto,
  UpdateCircuitPlayerDto,
  type LevelChangeReason,
} from '../dto/circuit-organizer.dto';
import {
  checkTeamEligibility,
  levelFromRating,
  levelLabel,
  suggestLevelChange,
  type CategorySpec,
  type EligibilityResult,
} from './category-rules';
import { CircuitAuditService } from './circuit-audit.service';

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export type RegistrationPlayersInput = {
  player1UserId?: string | null;
  player2UserId?: string | null;
  player1Name: string;
  player2Name: string;
  player1Email?: string | null;
  player2Email?: string | null;
};

export type RegistrationEvaluation = {
  player1Id: string;
  player2Id: string;
  review: string | null;
};

const PRIVATE_FIELDS = ['document', 'phone', 'email', 'notes'] as const;

@Injectable()
export class CircuitPlayersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: CircuitAccessService,
    private readonly audit: CircuitAuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Padrón
  // ---------------------------------------------------------------------------

  async list(
    circuitId: string,
    viewerId: string | null | undefined,
    filters: { q?: string; level?: number; status?: string } = {},
  ) {
    await this.ensureCircuit(circuitId);
    const internal = await this.access.can(circuitId, viewerId, 'circuit.view_internal');
    const params: unknown[] = [circuitId];
    const where: string[] = [];
    if (!internal) {
      where.push(`cp.status = 'ACTIVE'`);
    } else if (filters.status) {
      params.push(filters.status);
      where.push(`cp.status = $${params.length}`);
    }
    if (filters.level) {
      params.push(Number(filters.level));
      where.push(`cp.level = $${params.length}`);
    }
    if (filters.q?.trim()) {
      params.push(`%${filters.q.trim().toLowerCase()}%`);
      where.push(
        `(lower(cp.full_name) LIKE $${params.length} OR lower(COALESCE(cp.document, '')) LIKE $${params.length})`,
      );
    }

    const result = await this.db.query(
      `SELECT cp.*, p.photo_url, p.rating,
              (SELECT COUNT(DISTINCT r.tournament_id)::int
               FROM tournament_registrations r
               INNER JOIN tournaments t ON t.id = r.tournament_id
               WHERE t.circuit_id = cp.circuit_id AND r.status = 'APPROVED'
                 AND (r.circuit_player1_id = cp.id OR r.circuit_player2_id = cp.id)) AS tournaments_played
       FROM circuit_players cp
       LEFT JOIN players p ON p.user_id = cp.user_id
       WHERE cp.circuit_id = $1 ${where.map((w) => `AND ${w}`).join(' ')}
       ORDER BY cp.level ASC NULLS LAST, lower(cp.full_name) ASC
       LIMIT 1000`,
      params,
    );
    return result.rows.map((row) => this.present(row, internal));
  }

  async getOne(circuitId: string, playerId: string, viewerId: string | null | undefined) {
    const internal = await this.access.can(circuitId, viewerId, 'circuit.view_internal');
    const row = await this.findPlayer(this.db, circuitId, playerId);
    if (!internal && row.status !== 'ACTIVE') throw new NotFoundException('Jugador no encontrado');
    const [history, stats] = await Promise.all([
      this.history(circuitId, playerId),
      this.stats(circuitId, row),
    ]);
    return { player: this.present(row, internal), history, stats };
  }

  async create(circuitId: string, actorId: string, dto: CreateCircuitPlayerDto) {
    await this.access.assert(circuitId, actorId, 'circuit.edit');
    await this.ensureCircuit(circuitId);

    const row = await this.db.transaction(async (client) => {
      if (dto.userId) {
        const existing = await client.query(
          `SELECT id FROM circuit_players WHERE circuit_id = $1 AND user_id = $2`,
          [circuitId, dto.userId],
        );
        if (existing.rows[0]) {
          throw new ConflictException('Ese jugador ya está en el padrón del circuito');
        }
        const player = await this.ensureForUser(client, circuitId, dto.userId, actorId);
        const overrides = this.contactUpdates(dto);
        if (dto.level != null && dto.level !== player.level) {
          await this.changeLevel(client, player, dto.level, 'CORRECTION', actorId, null);
        }
        if (overrides.columns.length) {
          await client.query(
            `UPDATE circuit_players SET ${overrides.columns.join(', ')}, updated_at = NOW()
             WHERE id = $1`,
            [player.id, ...overrides.values],
          );
        }
        return this.findPlayer(client, circuitId, player.id);
      }

      const fullName = dto.fullName?.trim();
      if (!fullName) throw new BadRequestException('Indicá el nombre del jugador');
      const inserted = await client.query(
        `INSERT INTO circuit_players
          (circuit_id, full_name, document, phone, email, city, gender, level, level_source,
           status, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'CIRCUIT',$9,$10)
         RETURNING *`,
        [
          circuitId,
          fullName,
          dto.document?.trim() || null,
          dto.phone?.trim() || null,
          dto.email?.trim().toLowerCase() || null,
          dto.city?.trim() || null,
          dto.gender ?? null,
          dto.level ?? null,
          dto.level != null ? 'ACTIVE' : 'PENDING',
          actorId,
        ],
      );
      await this.insertHistory(client, inserted.rows[0], null, dto.level ?? null, 'INITIAL', actorId);
      return inserted.rows[0];
    });

    await this.audit.log(circuitId, actorId, {
      action: 'player.create',
      entityType: 'circuit_player',
      entityId: row.id,
      summary: `Alta en el padrón: ${row.full_name} (${levelLabel(row.level) ?? 'sin categoría'})`,
    });
    return this.present(row, true);
  }

  async update(circuitId: string, playerId: string, actorId: string, dto: UpdateCircuitPlayerDto) {
    await this.access.assert(circuitId, actorId, 'circuit.edit');
    const current = await this.findPlayer(this.db, circuitId, playerId);
    const { columns, values } = this.contactUpdates(dto);
    if (dto.fullName !== undefined) {
      columns.push(`full_name = $${values.length + 2}`);
      values.push(dto.fullName.trim());
    }
    if (dto.status !== undefined) {
      columns.push(`status = $${values.length + 2}`);
      values.push(dto.status);
    }
    if (dto.notes !== undefined) {
      columns.push(`notes = $${values.length + 2}`);
      values.push(dto.notes.trim() || null);
    }
    if (!columns.length) return this.present(current, true);

    const result = await this.db.query(
      `UPDATE circuit_players SET ${columns.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [playerId, ...values],
    );
    const row = result.rows[0];
    if (dto.status && dto.status !== current.status) {
      await this.audit.log(circuitId, actorId, {
        action: 'player.status',
        entityType: 'circuit_player',
        entityId: playerId,
        summary: `${row.full_name}: estado ${current.status} → ${row.status}`,
      });
    }
    return this.present(row, true);
  }

  async setLevel(circuitId: string, playerId: string, actorId: string, dto: SetCircuitPlayerLevelDto) {
    await this.access.assert(circuitId, actorId, 'circuit.edit');
    const result = await this.db.transaction(async (client) => {
      const player = await this.findPlayer(client, circuitId, playerId, true);
      const reason = dto.reason ?? this.inferReason(player.level, dto.level);
      await this.changeLevel(client, player, dto.level, reason, actorId, dto.note ?? null);
      return { before: player, after: await this.findPlayer(client, circuitId, playerId) };
    });
    await this.audit.log(circuitId, actorId, {
      action: 'player.level',
      entityType: 'circuit_player',
      entityId: playerId,
      summary: `${result.after.full_name}: ${levelLabel(result.before.level) ?? 'sin categoría'} → ${levelLabel(result.after.level)}`,
      meta: { reason: dto.reason ?? null, note: dto.note ?? null },
    });
    return this.present(result.after, true);
  }

  async history(circuitId: string, playerId: string) {
    const result = await this.db.query(
      `SELECT h.*, u.name AS changed_by_name
       FROM circuit_player_level_history h
       LEFT JOIN users u ON u.id = h.changed_by_user_id
       WHERE h.circuit_id = $1 AND h.circuit_player_id = $2
       ORDER BY h.created_at DESC`,
      [circuitId, playerId],
    );
    return result.rows;
  }

  /** Vincula al padrón a los jugadores de inscripciones viejas del circuito. */
  async syncFromRegistrations(circuitId: string, actorId: string) {
    await this.access.assert(circuitId, actorId, 'circuit.edit');
    const regs = await this.db.query(
      `SELECT r.*, cc.level AS category_level
       FROM tournament_registrations r
       INNER JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN circuit_categories cc ON cc.id = t.circuit_category_id
       WHERE t.circuit_id = $1 AND r.status = 'APPROVED'
         AND (r.circuit_player1_id IS NULL OR r.circuit_player2_id IS NULL)
       ORDER BY r.created_at ASC`,
      [circuitId],
    );
    let linked = 0;
    await this.db.transaction(async (client) => {
      for (const reg of regs.rows) {
        const fallback = reg.category_level != null ? Number(reg.category_level) : null;
        const p1 = reg.player1_user_id
          ? await this.ensureForUser(client, circuitId, reg.player1_user_id, actorId)
          : await this.ensureGuest(client, circuitId, reg.player1_name, reg.player1_email, fallback, 'ACTIVE', actorId);
        const p2 = reg.player2_user_id
          ? await this.ensureForUser(client, circuitId, reg.player2_user_id, actorId)
          : await this.ensureGuest(client, circuitId, reg.player2_name, reg.player2_email, fallback, 'ACTIVE', actorId);
        await client.query(
          `UPDATE tournament_registrations SET circuit_player1_id = $2, circuit_player2_id = $3 WHERE id = $1`,
          [reg.id, p1.id, p2.id],
        );
        linked++;
      }
    });
    if (linked) {
      await this.audit.log(circuitId, actorId, {
        action: 'player.sync',
        summary: `Padrón sincronizado con ${linked} inscripción(es) anteriores`,
      });
    }
    return { linked };
  }

  // ---------------------------------------------------------------------------
  // Ascensos y descensos
  // ---------------------------------------------------------------------------

  async promotionSuggestions(
    circuitId: string,
    actorId: string,
    options: { promoteTop?: number; relegateBottom?: number } = {},
  ) {
    await this.access.assert(circuitId, actorId, 'circuit.view_internal');
    const promoteTop = clampInt(options.promoteTop, 0, 20, 2);
    const relegateBottom = clampInt(options.relegateBottom, 0, 20, 2);

    const rows = await this.db.query(
      `SELECT cc.id AS category_id, cc.label AS category_label, cc.gender AS category_gender,
              cc.level AS category_level, cr.points, cr.wins,
              cp.id AS circuit_player_id, cp.full_name, cp.level AS player_level
       FROM circuit_rankings cr
       INNER JOIN circuit_categories cc ON cc.id = cr.category_id
       INNER JOIN players p ON p.id = cr.player_id
       INNER JOIN circuit_players cp ON cp.circuit_id = cr.circuit_id AND cp.user_id = p.user_id
       WHERE cr.circuit_id = $1 AND cc.kind = 'FIXED' AND cc.level IS NOT NULL
       ORDER BY cc.sort_order, cc.level, cr.category_id, cr.points DESC, cr.wins DESC`,
      [circuitId],
    );

    const byCategory = new Map<string, any[]>();
    for (const row of rows.rows) {
      const list = byCategory.get(row.category_id) ?? [];
      list.push(row);
      byCategory.set(row.category_id, list);
    }

    const seen = new Set<string>();
    const suggestions: any[] = [];
    for (const ranked of byCategory.values()) {
      ranked.forEach((row, index) => {
        if (seen.has(row.circuit_player_id)) return;
        const categoryLevel = Number(row.category_level);
        if (row.player_level != null && Number(row.player_level) !== categoryLevel) return;
        const change = suggestLevelChange(
          categoryLevel,
          index + 1,
          ranked.length,
          promoteTop,
          relegateBottom,
        );
        if (!change) return;
        seen.add(row.circuit_player_id);
        suggestions.push({
          categoryId: row.category_id,
          categoryLabel: row.category_label,
          categoryGender: row.category_gender,
          playerId: row.circuit_player_id,
          fullName: row.full_name,
          position: index + 1,
          totalRanked: ranked.length,
          points: Number(row.points) || 0,
          fromLevel: categoryLevel,
          toLevel: change.toLevel,
          direction: change.direction,
        });
      });
    }
    return { promoteTop, relegateBottom, suggestions };
  }

  async applyLevelChanges(circuitId: string, actorId: string, dto: ApplyLevelChangesDto) {
    await this.access.assert(circuitId, actorId, 'circuit.edit');
    const applied = await this.db.transaction(async (client) => {
      const done: Array<{ id: string; name: string; from: number | null; to: number; reason: string }> = [];
      for (const change of dto.changes) {
        const player = await this.findPlayer(client, circuitId, change.playerId, true);
        if (player.level === change.toLevel) continue;
        await this.changeLevel(client, player, change.toLevel, change.reason, actorId, dto.note ?? null);
        done.push({
          id: player.id,
          name: player.full_name,
          from: player.level,
          to: change.toLevel,
          reason: change.reason,
        });
      }
      return done;
    });

    if (applied.length) {
      const ups = applied.filter((c) => c.reason === 'PROMOTION').length;
      const downs = applied.filter((c) => c.reason === 'RELEGATION').length;
      await this.audit.log(circuitId, actorId, {
        action: 'player.level_bulk',
        summary: `Cambios de categoría: ${ups} ascenso(s), ${downs} descenso(s), ${applied.length - ups - downs} corrección(es)`,
        meta: { changes: applied },
      });
    }
    return { applied: applied.length, changes: applied };
  }

  // ---------------------------------------------------------------------------
  // Inscripción validada por categoría
  // ---------------------------------------------------------------------------

  /**
   * Vincula la pareja al padrón y aplica la regla de categoría del circuito.
   * Bloquea si alguien juega "para abajo"; deja la inscripción para revisar si falta
   * la categoría de algún jugador o si es nuevo en el padrón y se anotó solo.
   */
  async evaluateRegistration(
    tournament: { circuit_id: string; circuit_category_id: string | null },
    input: RegistrationPlayersInput,
    options: { managerRegistration: boolean; actorUserId: string | null },
  ): Promise<RegistrationEvaluation> {
    const category = await this.loadCategory(tournament.circuit_category_id);
    const newcomerStatus = options.managerRegistration ? 'ACTIVE' : 'PENDING';
    const fallbackLevel = category.kind === 'FIXED' ? category.level : null;

    return this.db.transaction(async (client) => {
      const resolve = async (userId?: string | null, name?: string, email?: string | null) =>
        userId
          ? this.ensureForUser(client, tournament.circuit_id, userId, options.actorUserId)
          : this.ensureGuest(
              client,
              tournament.circuit_id,
              name ?? '',
              email ?? null,
              fallbackLevel,
              newcomerStatus,
              options.actorUserId,
            );

      const p1 = await resolve(input.player1UserId, input.player1Name, input.player1Email);
      const p2 = await resolve(input.player2UserId, input.player2Name, input.player2Email);
      if (p1.id === p2.id) {
        throw new BadRequestException('La pareja tiene que tener dos jugadores distintos');
      }

      const names: [string, string] = [p1.full_name, p2.full_name];
      const verdict: EligibilityResult = checkTeamEligibility(
        category,
        [p1.level ?? null, p2.level ?? null],
        names,
      );
      if (verdict.status === 'BLOCKED') {
        throw new BadRequestException({
          message: options.managerRegistration
            ? `${verdict.reason} Corregí la categoría en el padrón si corresponde.`
            : verdict.reason,
          code: 'CATEGORY_NOT_ALLOWED',
        });
      }

      const reviews: string[] = [];
      if (verdict.status === 'REVIEW') reviews.push(verdict.reason);
      const pending = [p1, p2].filter((p) => p.status === 'PENDING' && p.level != null);
      if (pending.length) {
        reviews.push(
          `Nuevo(s) en el padrón con categoría a confirmar: ${pending
            .map((p) => `${p.full_name} (${levelLabel(p.level)})`)
            .join(', ')}.`,
        );
      }
      return { player1Id: p1.id, player2Id: p2.id, review: reviews.join(' ') || null };
    });
  }

  /** Al aprobar la inscripción, el organizador valida a los jugadores nuevos del padrón. */
  async confirmRegistrationPlayers(registration: {
    circuit_player1_id?: string | null;
    circuit_player2_id?: string | null;
  }) {
    const ids = [registration.circuit_player1_id, registration.circuit_player2_id].filter(Boolean);
    if (!ids.length) return;
    await this.db.query(
      `UPDATE circuit_players SET status = 'ACTIVE', updated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND status = 'PENDING' AND level IS NOT NULL`,
      [ids],
    );
  }

  // ---------------------------------------------------------------------------
  // Estadísticas
  // ---------------------------------------------------------------------------

  private async stats(circuitId: string, player: any) {
    const regs = await this.db.query(
      `SELECT r.id, r.tournament_id
       FROM tournament_registrations r
       INNER JOIN tournaments t ON t.id = r.tournament_id
       WHERE t.circuit_id = $1 AND r.status = 'APPROVED'
         AND (r.circuit_player1_id = $2 OR r.circuit_player2_id = $2
           OR ($3::uuid IS NOT NULL AND (r.player1_user_id = $3 OR r.player2_user_id = $3)))`,
      [circuitId, player.id, player.user_id ?? null],
    );
    const regIds = regs.rows.map((r) => r.id);
    const tournaments = new Set(regs.rows.map((r) => r.tournament_id)).size;

    const totals = {
      tournaments,
      matches: 0,
      wins: 0,
      losses: 0,
      walkoverWins: 0,
      walkoverLosses: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      titles: 0,
      finals: 0,
      winRate: 0,
    };
    const recent: any[] = [];

    if (regIds.length) {
      const matches = await this.db.query(
        `SELECT m.id, m.tournament_id, m.round_label, m.phase, m.next_match_id, m.score,
                m.team_a_registration_id, m.team_b_registration_id, m.team_a_name, m.team_b_name,
                m.winner_registration_id, COALESCE(m.finished_at, m.updated_at) AS played_at,
                t.name AS tournament_name
         FROM tournament_matches m
         INNER JOIN tournaments t ON t.id = m.tournament_id
         WHERE m.status = 'FINISHED'
           AND COALESCE((m.score->>'bye')::boolean, FALSE) = FALSE
           AND (m.team_a_registration_id = ANY($1::uuid[]) OR m.team_b_registration_id = ANY($1::uuid[]))
         ORDER BY played_at DESC`,
        [regIds],
      );
      const mine = new Set(regIds);
      for (const m of matches.rows) {
        const side = mine.has(m.team_a_registration_id) ? 'A' : 'B';
        const myReg = side === 'A' ? m.team_a_registration_id : m.team_b_registration_id;
        const won = m.winner_registration_id === myReg;
        const walkover = !!m.score?.walkover;
        totals.matches++;
        if (won) totals.wins++;
        else totals.losses++;
        if (walkover && won) totals.walkoverWins++;
        if (walkover && !won) totals.walkoverLosses++;
        const sets: Array<{ teamA: number; teamB: number }> = Array.isArray(m.score?.sets) ? m.score.sets : [];
        for (const s of sets) {
          const mineGames = side === 'A' ? Number(s.teamA) : Number(s.teamB);
          const theirGames = side === 'A' ? Number(s.teamB) : Number(s.teamA);
          totals.gamesWon += mineGames;
          totals.gamesLost += theirGames;
          if (mineGames > theirGames) totals.setsWon++;
          else if (theirGames > mineGames) totals.setsLost++;
        }
        const isFinal = m.phase === 'KNOCKOUT' && !m.next_match_id;
        if (isFinal) {
          totals.finals++;
          if (won) totals.titles++;
        }
        if (recent.length < 10) {
          recent.push({
            matchId: m.id,
            tournamentId: m.tournament_id,
            tournamentName: m.tournament_name,
            roundLabel: m.round_label,
            rival: side === 'A' ? m.team_b_name : m.team_a_name,
            won,
            walkover,
            sets: sets.map((s) => (side === 'A' ? [s.teamA, s.teamB] : [s.teamB, s.teamA])),
            playedAt: m.played_at,
          });
        }
      }
      totals.winRate = totals.matches ? Math.round((totals.wins / totals.matches) * 100) : 0;
    }

    let placements: any[] = [];
    let ranking: any[] = [];
    if (player.user_id) {
      const [awards, rank] = await Promise.all([
        this.db.query(
          `SELECT a.placement, a.points, a.created_at, t.id AS tournament_id, t.name AS tournament_name,
                  cc.label AS category_label
           FROM circuit_points_awards a
           INNER JOIN players p ON p.id = a.player_id
           INNER JOIN tournaments t ON t.id = a.tournament_id
           INNER JOIN circuit_categories cc ON cc.id = a.category_id
           WHERE a.circuit_id = $1 AND p.user_id = $2
           ORDER BY a.created_at DESC`,
          [circuitId, player.user_id],
        ),
        this.db.query(
          `SELECT ranked.* FROM (
             SELECT cr.category_id, cc.label AS category_label, cc.gender AS category_gender,
                    cr.points, cr.wins, cr.losses, cr.tournaments_played, p.user_id,
                    RANK() OVER (PARTITION BY cr.category_id ORDER BY cr.points DESC, cr.wins DESC) AS position
             FROM circuit_rankings cr
             INNER JOIN players p ON p.id = cr.player_id
             INNER JOIN circuit_categories cc ON cc.id = cr.category_id
             WHERE cr.circuit_id = $1
           ) ranked WHERE ranked.user_id = $2`,
          [circuitId, player.user_id],
        ),
      ]);
      placements = awards.rows;
      ranking = rank.rows.map(({ user_id: _u, ...row }) => ({ ...row, position: Number(row.position) }));
    }

    return { totals, recent, placements, ranking };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  async ensureForUser(q: Queryable, circuitId: string, userId: string, actorId: string | null) {
    const existing = await q.query(
      `SELECT * FROM circuit_players WHERE circuit_id = $1 AND user_id = $2`,
      [circuitId, userId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const profile = await q.query(
      `SELECT u.name, u.email, p.rating, p.city
       FROM users u LEFT JOIN players p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    const user = profile.rows[0];
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const level = levelFromRating(user.rating);

    const inserted = await q.query(
      `INSERT INTO circuit_players
        (circuit_id, user_id, full_name, email, city, level, level_source, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,'APP',$7,$8)
       ON CONFLICT (circuit_id, user_id) WHERE user_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [
        circuitId,
        userId,
        user.name || 'Jugador',
        user.email ?? null,
        user.city ?? null,
        level,
        level != null ? 'ACTIVE' : 'PENDING',
        actorId,
      ],
    );
    if (!inserted.rows[0]) {
      const again = await q.query(
        `SELECT * FROM circuit_players WHERE circuit_id = $1 AND user_id = $2`,
        [circuitId, userId],
      );
      return again.rows[0];
    }
    await this.insertHistory(q, inserted.rows[0], null, level, 'INITIAL', actorId, 'Categoría x4match');
    return inserted.rows[0];
  }

  private async ensureGuest(
    q: Queryable,
    circuitId: string,
    name: string,
    email: string | null,
    fallbackLevel: number | null,
    status: 'ACTIVE' | 'PENDING',
    actorId: string | null,
  ) {
    const fullName = name.trim();
    if (!fullName) throw new BadRequestException('Falta el nombre de un jugador');
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const existing = await q.query(
      `SELECT * FROM circuit_players
       WHERE circuit_id = $1 AND user_id IS NULL
         AND (($2::text IS NOT NULL AND lower(email) = $2)
           OR lower(trim(full_name)) = lower($3))
       ORDER BY (lower(email) = $2) DESC NULLS LAST, created_at ASC
       LIMIT 1`,
      [circuitId, normalizedEmail, fullName],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await q.query(
      `INSERT INTO circuit_players
        (circuit_id, full_name, email, level, level_source, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,'REGISTRATION',$5,$6)
       RETURNING *`,
      [circuitId, fullName, normalizedEmail, fallbackLevel, fallbackLevel != null ? status : 'PENDING', actorId],
    );
    await this.insertHistory(
      q,
      inserted.rows[0],
      null,
      fallbackLevel,
      'INITIAL',
      actorId,
      'Categoría del torneo en el que se inscribió',
    );
    return inserted.rows[0];
  }

  private async changeLevel(
    q: Queryable,
    player: any,
    toLevel: number,
    reason: LevelChangeReason,
    actorId: string,
    note: string | null,
  ) {
    await q.query(
      `UPDATE circuit_players
       SET level = $2, level_source = 'CIRCUIT',
           status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [player.id, toLevel],
    );
    await this.insertHistory(q, player, player.level ?? null, toLevel, reason, actorId, note);
  }

  private async insertHistory(
    q: Queryable,
    player: { id: string; circuit_id: string },
    fromLevel: number | null,
    toLevel: number | null,
    reason: 'INITIAL' | LevelChangeReason,
    actorId: string | null,
    note: string | null = null,
  ) {
    await q.query(
      `INSERT INTO circuit_player_level_history
        (circuit_id, circuit_player_id, from_level, to_level, reason, note, changed_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [player.circuit_id, player.id, fromLevel, toLevel, reason, note, actorId],
    );
  }

  private inferReason(from: number | null, to: number): LevelChangeReason {
    if (from == null || from === to) return 'CORRECTION';
    return to < from ? 'PROMOTION' : 'RELEGATION';
  }

  private contactUpdates(dto: Partial<CreateCircuitPlayerDto>) {
    const columns: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown) => {
      columns.push(`${column} = $${values.length + 2}`);
      values.push(value);
    };
    if (dto.document !== undefined) push('document', dto.document?.trim() || null);
    if (dto.phone !== undefined) push('phone', dto.phone?.trim() || null);
    if (dto.email !== undefined) push('email', dto.email?.trim().toLowerCase() || null);
    if (dto.city !== undefined) push('city', dto.city?.trim() || null);
    if (dto.gender !== undefined) push('gender', dto.gender ?? null);
    return { columns, values };
  }

  private async loadCategory(categoryId: string | null): Promise<CategorySpec> {
    if (!categoryId) return { kind: 'OPEN', level: null, sumTotal: null };
    const result = await this.db.query(
      `SELECT kind, level, sum_total FROM circuit_categories WHERE id = $1`,
      [categoryId],
    );
    const row = result.rows[0];
    if (!row) return { kind: 'OPEN', level: null, sumTotal: null };
    return {
      kind: row.kind,
      level: row.level != null ? Number(row.level) : null,
      sumTotal: row.sum_total != null ? Number(row.sum_total) : null,
    };
  }

  private async findPlayer(q: Queryable, circuitId: string, playerId: string, lock = false) {
    const result = await q.query(
      `SELECT cp.*, p.photo_url, p.rating
       FROM circuit_players cp
       LEFT JOIN players p ON p.user_id = cp.user_id
       WHERE cp.id = $1 AND cp.circuit_id = $2 ${lock ? 'FOR UPDATE OF cp' : ''}`,
      [playerId, circuitId],
    );
    if (!result.rows[0]) throw new NotFoundException('Jugador no encontrado en el padrón');
    return result.rows[0];
  }

  private async ensureCircuit(circuitId: string) {
    const result = await this.db.query(`SELECT id FROM circuits WHERE id = $1`, [circuitId]);
    if (!result.rows[0]) throw new NotFoundException('Circuito no encontrado');
  }

  private present(row: any, internal: boolean) {
    const appLevel = row.user_id ? levelFromRating(row.rating) : null;
    const base = {
      ...row,
      level: row.level != null ? Number(row.level) : null,
      level_label: levelLabel(row.level),
      app_level: appLevel,
      app_level_label: levelLabel(appLevel),
      rating: undefined,
    };
    if (!internal) for (const field of PRIVATE_FIELDS) delete base[field];
    return base;
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}
