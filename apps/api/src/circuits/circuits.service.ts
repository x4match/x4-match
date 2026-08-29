import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AddCircuitCategoryDto } from './dto/add-circuit-category.dto';
import { AddCircuitVenueDto } from './dto/add-circuit-venue.dto';
import { CreateCircuitDto } from './dto/create-circuit.dto';
import { CreateCircuitStageDto } from './dto/create-circuit-stage.dto';

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
    return result.rows[0];
  }

  async getById(id: string) {
    const circuitResult = await this.db.query(`SELECT * FROM circuits WHERE id = $1`, [id]);
    const circuit = circuitResult.rows[0];
    if (!circuit) {
      throw new NotFoundException('Circuito no encontrado');
    }

    const [categories, venues, stages, rankings] = await Promise.all([
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
                cc.label AS category_label
         FROM circuit_stages cs
         INNER JOIN clubs cl ON cl.id = cs.club_id
         LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
         WHERE cs.circuit_id = $1
         ORDER BY cs.start_date ASC, cs.sort_order ASC`,
        [id],
      ),
      this.db.query(
        `SELECT cr.*,
                p.nickname,
                u.name AS player_name,
                cc.label AS category_label
         FROM circuit_rankings cr
         INNER JOIN players p ON p.id = cr.player_id
         INNER JOIN users u ON u.id = p.user_id
         INNER JOIN circuit_categories cc ON cc.id = cr.category_id
         WHERE cr.circuit_id = $1
         ORDER BY cr.category_id, cr.points DESC, cr.wins DESC`,
        [id],
      ),
    ]);

    return {
      ...circuit,
      categories: categories.rows,
      venues: venues.rows,
      stages: stages.rows,
      rankings: rankings.rows,
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
              cc.label AS category_label
       FROM circuit_rankings cr
       INNER JOIN players p ON p.id = cr.player_id
       INNER JOIN users u ON u.id = p.user_id
       INNER JOIN circuit_categories cc ON cc.id = cr.category_id
       WHERE cr.circuit_id = $1 ${categoryFilter}
       ORDER BY cr.category_id, cr.points DESC, cr.wins DESC`,
      params,
    );
    return result.rows;
  }

  async publish(circuitId: string, userId: string) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const result = await this.db.query(
      `UPDATE circuits SET status = 'ACTIVE', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [circuitId],
    );
    return result.rows[0];
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
