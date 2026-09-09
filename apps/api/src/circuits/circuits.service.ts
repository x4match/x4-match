import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AddCircuitCategoryDto } from './dto/add-circuit-category.dto';
import { AddCircuitVenueDto } from './dto/add-circuit-venue.dto';
import { CreateCircuitDto } from './dto/create-circuit.dto';
import { CreateCircuitStageDto } from './dto/create-circuit-stage.dto';
import {
  CreateCircuitEventDto,
  PublishCircuitStageDto,
  UpsertCircuitPointRulesDto,
} from './dto/circuit-wpe.dto';

/** Tabla de puntos por defecto (paridad operativa con Circuito WPE). */
const DEFAULT_POINT_RULES: Array<{ placement: string; points: number; sortOrder: number }> = [
  { placement: 'WINNER', points: 160, sortOrder: 1 },
  { placement: 'FINALIST', points: 120, sortOrder: 2 },
  { placement: 'SEMI', points: 100, sortOrder: 3 },
  { placement: 'QUARTERS', points: 80, sortOrder: 4 },
  { placement: 'R16', points: 60, sortOrder: 5 },
  { placement: 'R32', points: 40, sortOrder: 6 },
  { placement: 'R64', points: 30, sortOrder: 7 },
  { placement: 'GROUP_ELIMINATED', points: 20, sortOrder: 8 },
  { placement: 'PARTICIPATION', points: 10, sortOrder: 9 },
];

@Injectable()
export class CircuitsService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const result = await this.db.query(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM circuit_venues cv WHERE cv.circuit_id = c.id) AS venue_count,
              (SELECT COUNT(*)::int FROM circuit_categories cc WHERE cc.circuit_id = c.id) AS category_count,
              (
                SELECT MIN(cs.start_date)
                FROM circuit_stages cs
                WHERE cs.circuit_id = c.id AND cs.start_date >= NOW()
              ) AS next_stage_date
       FROM circuits c
       ORDER BY
         CASE c.status WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
         c.created_at DESC
       LIMIT 50`,
    );
    return result.rows;
  }

  async create(userId: string, dto: CreateCircuitDto) {
    await this.assertCanCreateEvents(userId);
    const result = await this.db.query(
      `INSERT INTO circuits (name, description, season, status, created_by_user_id, start_date, end_date)
       VALUES ($1, $2, $3, COALESCE($4, 'DRAFT')::circuit_status, $5, $6, $7)
       RETURNING *`,
      [
        dto.name,
        dto.description ?? null,
        dto.season ?? null,
        dto.status ?? 'DRAFT',
        userId,
        dto.startDate ?? null,
        dto.endDate ?? null,
      ],
    );
    const circuit = result.rows[0];
    await this.seedDefaultPointRules(circuit.id);
    return circuit;
  }

  async getById(id: string) {
    const circuitResult = await this.db.query(`SELECT * FROM circuits WHERE id = $1`, [id]);
    const circuit = circuitResult.rows[0];
    if (!circuit) {
      throw new NotFoundException('Circuito no encontrado');
    }

    const [categories, venues, stages, rankings, pointRules] = await Promise.all([
      this.db.query(
        `SELECT id, circuit_id, label, gender, sort_order, created_at
         FROM circuit_categories
         WHERE circuit_id = $1
         ORDER BY sort_order ASC, label ASC`,
        [id],
      ),
      this.db.query(
        `SELECT cv.club_id, cl.name AS club_name, cl.city, cl.zone, cl.address,
                (SELECT COUNT(*)::int FROM circuit_stages cs WHERE cs.circuit_id = cv.circuit_id AND cs.club_id = cv.club_id) AS stage_count
         FROM circuit_venues cv
         INNER JOIN clubs cl ON cl.id = cv.club_id
         WHERE cv.circuit_id = $1
         ORDER BY cl.name ASC`,
        [id],
      ),
      this.db.query(
        `SELECT cs.*,
                cl.name AS club_name,
                cc.label AS category_label,
                cc.gender AS category_gender,
                t.status AS tournament_status,
                t.name AS tournament_name
         FROM circuit_stages cs
         INNER JOIN clubs cl ON cl.id = cs.club_id
         LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
         LEFT JOIN tournaments t ON t.id = cs.tournament_id
         WHERE cs.circuit_id = $1
         ORDER BY cs.start_date ASC, cs.sort_order ASC, cc.sort_order ASC NULLS LAST`,
        [id],
      ),
      this.db.query(
        `SELECT cr.*,
                p.nickname,
                u.name AS player_name,
                cc.label AS category_label,
                cc.gender AS category_gender
         FROM circuit_rankings cr
         INNER JOIN players p ON p.id = cr.player_id
         INNER JOIN users u ON u.id = p.user_id
         INNER JOIN circuit_categories cc ON cc.id = cr.category_id
         WHERE cr.circuit_id = $1
         ORDER BY cr.category_id, cr.points DESC, cr.wins DESC, cr.position ASC NULLS LAST`,
        [id],
      ),
      this.db.query(
        `SELECT id, circuit_id, placement, points, sort_order
         FROM circuit_point_rules
         WHERE circuit_id = $1
         ORDER BY sort_order ASC, points DESC`,
        [id],
      ),
    ]);

    return {
      ...circuit,
      categories: categories.rows,
      venues: venues.rows,
      stages: stages.rows,
      rankings: rankings.rows,
      point_rules: pointRules.rows,
    };
  }

  async addCategory(circuitId: string, userId: string, dto: AddCircuitCategoryDto) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const result = await this.db.query(
      `INSERT INTO circuit_categories (circuit_id, label, gender, sort_order)
       VALUES ($1, $2, $3, COALESCE($4, 0))
       RETURNING *`,
      [circuitId, dto.label.trim(), dto.gender ?? null, dto.sortOrder ?? null],
    );
    return result.rows[0];
  }

  async addVenue(circuitId: string, userId: string, dto: AddCircuitVenueDto) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const club = await this.db.query(`SELECT id FROM clubs WHERE id = $1`, [dto.clubId]);
    if (!club.rows[0]) {
      throw new NotFoundException('Club no encontrado');
    }

    await this.db.query(
      `INSERT INTO circuit_venues (circuit_id, club_id)
       VALUES ($1, $2)
       ON CONFLICT (circuit_id, club_id) DO NOTHING`,
      [circuitId, dto.clubId],
    );

    return this.getById(circuitId);
  }

  async addStage(circuitId: string, userId: string, dto: CreateCircuitStageDto) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const result = await this.db.query(
      `INSERT INTO circuit_stages (circuit_id, club_id, category_id, tournament_id, name, start_date, end_date, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0))
       RETURNING *`,
      [
        circuitId,
        dto.clubId,
        dto.categoryId ?? null,
        dto.tournamentId ?? null,
        dto.name ?? null,
        dto.startDate,
        dto.endDate ?? null,
        dto.sortOrder ?? null,
      ],
    );
    return result.rows[0];
  }

  /**
   * Crea una “ETAPA” WPE: una fila de stage por categoría (mismo nombre/fecha/sede).
   * Opcionalmente publica el torneo de cada categoría.
   */
  async createEvent(circuitId: string, userId: string, dto: CreateCircuitEventDto) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const club = await this.db.query(`SELECT id, name FROM clubs WHERE id = $1`, [dto.clubId]);
    if (!club.rows[0]) throw new NotFoundException('Club no encontrado');

    await this.db.query(
      `INSERT INTO circuit_venues (circuit_id, club_id)
       VALUES ($1, $2)
       ON CONFLICT (circuit_id, club_id) DO NOTHING`,
      [circuitId, dto.clubId],
    );

    let categories = await this.db.query(
      `SELECT id, label, gender FROM circuit_categories WHERE circuit_id = $1 ORDER BY sort_order, label`,
      [circuitId],
    );
    if (dto.categoryIds?.length) {
      const wanted = new Set(dto.categoryIds);
      categories = {
        ...categories,
        rows: categories.rows.filter((c: any) => wanted.has(c.id)),
      };
    }
    if (!categories.rows.length) {
      throw new BadRequestException('Agregá categorías al circuito antes de crear la etapa');
    }

    const createdStages: any[] = [];
    for (let i = 0; i < categories.rows.length; i++) {
      const cat = categories.rows[i];
      const stage = await this.db.query(
        `INSERT INTO circuit_stages
           (circuit_id, club_id, category_id, name, start_date, end_date, sort_order, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'SCHEDULED')
         RETURNING *`,
        [
          circuitId,
          dto.clubId,
          cat.id,
          dto.name.trim(),
          dto.startDate,
          dto.endDate ?? null,
          i,
        ],
      );
      let row = stage.rows[0];
      if (dto.publishTournaments) {
        row = await this.publishStageInternal(circuitId, row.id, userId, {
          price: dto.price,
          maxTeams: dto.maxTeams,
          format: dto.format,
        });
      }
      createdStages.push(row);
    }

    return { eventName: dto.name.trim(), stages: createdStages };
  }

  async getPointRules(circuitId: string) {
    await this.ensureCircuit(circuitId);
    const result = await this.db.query(
      `SELECT id, circuit_id, placement, points, sort_order
       FROM circuit_point_rules WHERE circuit_id = $1
       ORDER BY sort_order ASC, points DESC`,
      [circuitId],
    );
    return result.rows;
  }

  async upsertPointRules(circuitId: string, userId: string, dto: UpsertCircuitPointRulesDto) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    await this.db.query(`DELETE FROM circuit_point_rules WHERE circuit_id = $1`, [circuitId]);
    for (let i = 0; i < dto.rules.length; i++) {
      const rule = dto.rules[i];
      await this.db.query(
        `INSERT INTO circuit_point_rules (circuit_id, placement, points, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [circuitId, rule.placement.trim().toUpperCase(), rule.points, rule.sortOrder ?? i + 1],
      );
    }
    return this.getPointRules(circuitId);
  }

  async publishStage(
    circuitId: string,
    stageId: string,
    userId: string,
    dto: PublishCircuitStageDto = {},
  ) {
    await this.assertCanManageCircuit(circuitId, userId);
    return this.publishStageInternal(circuitId, stageId, userId, dto);
  }

  async getRankings(circuitId: string, categoryId?: string) {
    await this.ensureCircuit(circuitId);

    const params: string[] = [circuitId];
    let categoryFilter = '';
    if (categoryId) {
      params.push(categoryId);
      categoryFilter = `AND cr.category_id = $2`;
    }

    const result = await this.db.query(
      `SELECT cr.*,
              p.nickname,
              u.name AS player_name,
              cc.label AS category_label,
              cc.gender AS category_gender
       FROM circuit_rankings cr
       INNER JOIN players p ON p.id = cr.player_id
       INNER JOIN users u ON u.id = p.user_id
       INNER JOIN circuit_categories cc ON cc.id = cr.category_id
       WHERE cr.circuit_id = $1 ${categoryFilter}
       ORDER BY cr.category_id, cr.points DESC, cr.wins DESC, cr.position ASC NULLS LAST`,
      params,
    );
    return result.rows;
  }

  async publish(circuitId: string, userId: string) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const rules = await this.getPointRules(circuitId);
    if (!rules.length) {
      await this.seedDefaultPointRules(circuitId);
    }

    const result = await this.db.query(
      `UPDATE circuits SET status = 'ACTIVE', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [circuitId],
    );
    return result.rows[0];
  }

  /**
   * Otorga puntos de ranking cuando un torneo de circuito pasa a FINISHED.
   * Idempotente vía circuit_points_awards UNIQUE (tournament_id, player_id).
   */
  async awardFromTournament(tournamentId: string) {
    const tournamentRes = await this.db.query(
      `SELECT id, circuit_id, circuit_stage_id, circuit_category_id, status, name
       FROM tournaments WHERE id = $1`,
      [tournamentId],
    );
    const tournament = tournamentRes.rows[0];
    if (!tournament?.circuit_id || !tournament.circuit_category_id) {
      return { awarded: false, reason: 'not_circuit_tournament' };
    }
    if (tournament.status !== 'FINISHED') {
      return { awarded: false, reason: 'not_finished' };
    }

    const existing = await this.db.query(
      `SELECT 1 FROM circuit_points_awards WHERE tournament_id = $1 LIMIT 1`,
      [tournamentId],
    );
    if (existing.rows[0]) {
      return { awarded: false, reason: 'already_awarded' };
    }

    const rulesRes = await this.db.query(
      `SELECT placement, points FROM circuit_point_rules WHERE circuit_id = $1`,
      [tournament.circuit_id],
    );
    if (!rulesRes.rows.length) {
      await this.seedDefaultPointRules(tournament.circuit_id);
    }
    const rules = new Map<string, number>(
      (await this.getPointRules(tournament.circuit_id)).map((r: any) => [
        String(r.placement).toUpperCase(),
        Number(r.points),
      ]),
    );

    const placements = await this.resolvePlayerPlacements(tournamentId);
    if (!placements.length) {
      return { awarded: false, reason: 'no_placements' };
    }

    for (const entry of placements) {
      const points =
        rules.get(entry.placement) ??
        rules.get('PARTICIPATION') ??
        0;
      if (points <= 0 && entry.placement !== 'PARTICIPATION') continue;

      await this.db.query(
        `INSERT INTO circuit_points_awards
           (circuit_id, category_id, stage_id, tournament_id, player_id, placement, points)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tournament_id, player_id) DO NOTHING`,
        [
          tournament.circuit_id,
          tournament.circuit_category_id,
          tournament.circuit_stage_id,
          tournamentId,
          entry.playerId,
          entry.placement,
          points,
        ],
      );

      const isWin = entry.placement === 'WINNER';
      await this.db.query(
        `INSERT INTO circuit_rankings
           (circuit_id, category_id, player_id, points, wins, losses, tournaments_played, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,1,NOW())
         ON CONFLICT (circuit_id, category_id, player_id)
         DO UPDATE SET
           points = circuit_rankings.points + EXCLUDED.points,
           wins = circuit_rankings.wins + EXCLUDED.wins,
           losses = circuit_rankings.losses + EXCLUDED.losses,
           tournaments_played = circuit_rankings.tournaments_played + 1,
           updated_at = NOW()`,
        [
          tournament.circuit_id,
          tournament.circuit_category_id,
          entry.playerId,
          points,
          isWin ? 1 : 0,
          isWin ? 0 : 1,
        ],
      );
    }

    await this.recomputePositions(tournament.circuit_id, tournament.circuit_category_id);

    if (tournament.circuit_stage_id) {
      await this.db.query(
        `UPDATE circuit_stages
         SET points_awarded = TRUE, status = 'FINISHED', updated_at = NOW()
         WHERE id = $1`,
        [tournament.circuit_stage_id],
      );
    }

    return { awarded: true, players: placements.length };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async publishStageInternal(
    circuitId: string,
    stageId: string,
    userId: string,
    dto: PublishCircuitStageDto,
  ) {
    const stageRes = await this.db.query(
      `SELECT cs.*, cc.label AS category_label, cc.gender AS category_gender, c.name AS circuit_name
       FROM circuit_stages cs
       INNER JOIN circuits c ON c.id = cs.circuit_id
       LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
       WHERE cs.id = $1 AND cs.circuit_id = $2`,
      [stageId, circuitId],
    );
    const stage = stageRes.rows[0];
    if (!stage) throw new NotFoundException('Etapa no encontrada');
    if (!stage.category_id) {
      throw new BadRequestException('La etapa necesita una categoría para publicar el torneo');
    }
    if (stage.tournament_id) {
      return stage;
    }

    const tournamentName = [
      stage.name || stage.circuit_name,
      stage.category_label,
      stage.category_gender,
    ]
      .filter(Boolean)
      .join(' · ');

    const created = await this.db.query(
      `INSERT INTO tournaments
        (club_id, name, description, category, format, gender, start_date, max_teams,
         courts_available, price, payment_required, status, organizer_user_id,
         modality, club_validation_status, circuit_id, circuit_stage_id, circuit_category_id)
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         2,$9,$10,'OPEN_REGISTRATION'::tournament_status,$11,
         'EXTERNAL'::tournament_modality,'APPROVED'::tournament_club_validation_status,
         $12,$13,$14
       )
       RETURNING *`,
      [
        stage.club_id,
        tournamentName,
        `Torneo del circuito ${stage.circuit_name}`,
        stage.category_label,
        dto.format ?? 'GROUPS_THEN_ELIMINATION',
        stage.category_gender,
        stage.start_date,
        dto.maxTeams ?? 16,
        dto.price ?? null,
        dto.price != null && Number(dto.price) > 0,
        userId,
        circuitId,
        stageId,
        stage.category_id,
      ],
    );

    const updated = await this.db.query(
      `UPDATE circuit_stages
       SET tournament_id = $2, status = 'OPEN', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [stageId, created.rows[0].id],
    );

    return {
      ...updated.rows[0],
      tournament_id: created.rows[0].id,
      tournament_status: created.rows[0].status,
      tournament_name: created.rows[0].name,
    };
  }

  private async seedDefaultPointRules(circuitId: string) {
    for (const rule of DEFAULT_POINT_RULES) {
      await this.db.query(
        `INSERT INTO circuit_point_rules (circuit_id, placement, points, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (circuit_id, placement) DO NOTHING`,
        [circuitId, rule.placement, rule.points, rule.sortOrder],
      );
    }
  }

  private async resolvePlayerPlacements(
    tournamentId: string,
  ): Promise<Array<{ playerId: string; placement: string }>> {
    const regs = await this.db.query(
      `SELECT id, player1_user_id, player2_user_id
       FROM tournament_registrations
       WHERE tournament_id = $1 AND status = 'APPROVED'`,
      [tournamentId],
    );
    if (!regs.rows.length) return [];

    const matches = await this.db.query(
      `SELECT * FROM tournament_matches
       WHERE tournament_id = $1 AND status = 'FINISHED'
       ORDER BY round DESC, bracket_position ASC NULLS LAST`,
      [tournamentId],
    );

    const placementByReg = new Map<string, string>();
    const hasBracket = matches.rows.some((m: any) => m.next_match_id || /final|semi|cuartos/i.test(m.round_label || ''));

    if (hasBracket) {
      for (const m of matches.rows) {
        const label = String(m.round_label || '').toLowerCase();
        const winner = m.winner_registration_id as string | null;
        const loser =
          winner && m.team_a_registration_id === winner
            ? m.team_b_registration_id
            : winner
              ? m.team_a_registration_id
              : null;

        if (label.includes('final') && !label.includes('semi')) {
          if (winner) placementByReg.set(winner, 'WINNER');
          if (loser) placementByReg.set(loser, 'FINALIST');
        } else if (label.includes('semi')) {
          if (loser && !placementByReg.has(loser)) placementByReg.set(loser, 'SEMI');
        } else if (label.includes('cuartos') || label.includes('quarter')) {
          if (loser && !placementByReg.has(loser)) placementByReg.set(loser, 'QUARTERS');
        } else if (label.includes('octavos') || label.includes('r16') || label.includes('16')) {
          if (loser && !placementByReg.has(loser)) placementByReg.set(loser, 'R16');
        } else if (label.includes('32')) {
          if (loser && !placementByReg.has(loser)) placementByReg.set(loser, 'R32');
        } else if (label.includes('64')) {
          if (loser && !placementByReg.has(loser)) placementByReg.set(loser, 'R64');
        } else if (loser && !placementByReg.has(loser)) {
          placementByReg.set(loser, 'GROUP_ELIMINATED');
        }
      }
    } else {
      // Round robin / standings: top positions map to WPE-like placements
      const standings = await this.computeSimpleStandings(tournamentId, regs.rows);
      const mapPos = (idx: number): string => {
        if (idx === 0) return 'WINNER';
        if (idx === 1) return 'FINALIST';
        if (idx === 2 || idx === 3) return 'SEMI';
        if (idx <= 7) return 'QUARTERS';
        return 'PARTICIPATION';
      };
      standings.forEach((regId, idx) => placementByReg.set(regId, mapPos(idx)));
    }

    for (const reg of regs.rows) {
      if (!placementByReg.has(reg.id)) {
        placementByReg.set(reg.id, 'PARTICIPATION');
      }
    }

    const out: Array<{ playerId: string; placement: string }> = [];
    for (const reg of regs.rows) {
      const placement = placementByReg.get(reg.id) || 'PARTICIPATION';
      const userIds = [reg.player1_user_id, reg.player2_user_id].filter(Boolean);
      for (const userId of userIds) {
        const player = await this.db.query(`SELECT id FROM players WHERE user_id = $1`, [userId]);
        if (player.rows[0]) {
          out.push({ playerId: player.rows[0].id, placement });
        }
      }
    }
    return out;
  }

  private async computeSimpleStandings(tournamentId: string, regs: any[]): Promise<string[]> {
    const stats = new Map<string, { w: number; l: number; pts: number }>();
    for (const r of regs) stats.set(r.id, { w: 0, l: 0, pts: 0 });

    const matches = await this.db.query(
      `SELECT team_a_registration_id, team_b_registration_id, winner_registration_id
       FROM tournament_matches WHERE tournament_id = $1 AND status = 'FINISHED'`,
      [tournamentId],
    );
    for (const m of matches.rows) {
      const a = m.team_a_registration_id;
      const b = m.team_b_registration_id;
      const w = m.winner_registration_id;
      if (!a || !b || !w) continue;
      const loser = w === a ? b : a;
      const ws = stats.get(w);
      const ls = stats.get(loser);
      if (ws) {
        ws.w += 1;
        ws.pts += 2;
      }
      if (ls) ls.l += 1;
    }

    return [...stats.entries()]
      .sort((x, y) => y[1].pts - x[1].pts || y[1].w - x[1].w)
      .map(([id]) => id);
  }

  private async recomputePositions(circuitId: string, categoryId: string) {
    await this.db.query(
      `WITH ranked AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC, wins DESC, losses ASC) AS pos
         FROM circuit_rankings
         WHERE circuit_id = $1 AND category_id = $2
       )
       UPDATE circuit_rankings cr
       SET position = ranked.pos
       FROM ranked
       WHERE cr.id = ranked.id`,
      [circuitId, categoryId],
    );
  }

  private async ensureCircuit(circuitId: string) {
    const result = await this.db.query(`SELECT id FROM circuits WHERE id = $1`, [circuitId]);
    if (!result.rows[0]) {
      throw new NotFoundException('Circuito no encontrado');
    }
  }

  private async getRole(userId: string): Promise<string> {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = result.rows[0]?.role;
    if (!role) throw new ForbiddenException('Usuario inválido');
    return role;
  }

  private async assertCanCreateEvents(userId: string) {
    const role = await this.getRole(userId);
    if (!['PLAYER', 'ORGANIZER', 'CLUB_ADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new ForbiddenException('No tenés permiso para crear circuitos');
    }
  }

  private async assertCanManageCircuit(circuitId: string, userId: string) {
    const role = await this.getRole(userId);
    if (role === 'SUPER_ADMIN' || role === 'CLUB_ADMIN') {
      await this.ensureCircuit(circuitId);
      return;
    }
    const result = await this.db.query(
      `SELECT created_by_user_id FROM circuits WHERE id = $1`,
      [circuitId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Circuito no encontrado');
    }
    if (result.rows[0].created_by_user_id !== userId) {
      throw new ForbiddenException('Solo el organizador de este circuito puede realizar esta acción');
    }
  }
}
