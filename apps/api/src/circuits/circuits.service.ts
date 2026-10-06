import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { uploadImageBuffer } from '../common/cloudinary/cloudinary.util';
import { DatabaseService } from '../database/database.service';
import { knockoutLoserPlacement } from '../tournaments/brackets/bracket-engine';
import { CircuitAccessService, circuitDisplayTitle } from './circuit-access.service';
import { CircuitStaffService } from './circuit-staff.service';
import { parseCategoryLabel } from './organizer/category-rules';
import { CircuitAuditService } from './organizer/circuit-audit.service';
import { AddCircuitCategoryDto } from './dto/add-circuit-category.dto';
import { AddCircuitVenueDto } from './dto/add-circuit-venue.dto';
import { CreateCircuitDto, UpdateCircuitDto } from './dto/create-circuit.dto';
import { CreateCircuitStageDto } from './dto/create-circuit-stage.dto';
import {
  CreateCircuitEventDto,
  PublishCircuitStageDto,
  UpsertCircuitPointRulesDto,
} from './dto/circuit-stage.dto';

/** Tabla de puntos por defecto para circuitos nuevos (cada circuito la puede editar). */
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

const IDENTITY_COLUMNS: Array<[keyof UpdateCircuitDto, string]> = [
  ['name', 'name'],
  ['shortName', 'short_name'],
  ['description', 'description'],
  ['season', 'season'],
  ['startDate', 'start_date'],
  ['endDate', 'end_date'],
  ['logoUrl', 'logo_url'],
  ['city', 'city'],
  ['contactPhone', 'contact_phone'],
  ['contactEmail', 'contact_email'],
  ['instagram', 'instagram'],
  ['website', 'website'],
];

function normalizeShortName(value: string | undefined | null): string | null {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.toUpperCase() : null;
}

function isShortNameConflict(error: unknown): boolean {
  const err = error as { code?: string; constraint?: string };
  return err?.code === '23505' && err.constraint === 'uq_circuits_short_name_active';
}

@Injectable()
export class CircuitsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: CircuitAccessService,
    private readonly staff: CircuitStaffService,
    private readonly audit: CircuitAuditService,
  ) {}

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
    const shortName = normalizeShortName(dto.shortName);
    let circuit: any;
    try {
      circuit = await this.db.transaction(async (client) => {
        const result = await client.query(
          `INSERT INTO circuits
             (name, short_name, description, season, status, created_by_user_id, start_date, end_date,
              logo_url, city, contact_phone, contact_email, instagram, website)
           VALUES ($1, $2, $3, $4, COALESCE($5, 'DRAFT')::circuit_status, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`,
          [
            dto.name.trim(),
            shortName,
            dto.description ?? null,
            dto.season ?? null,
            dto.status ?? 'DRAFT',
            userId,
            dto.startDate ?? null,
            dto.endDate ?? null,
            dto.logoUrl ?? null,
            dto.city ?? null,
            dto.contactPhone ?? null,
            dto.contactEmail ?? null,
            dto.instagram ?? null,
            dto.website ?? null,
          ],
        );
        const row = result.rows[0];
        await client.query(
          `INSERT INTO circuit_staff (circuit_id, user_id, role, status, invited_by_user_id, responded_at)
           VALUES ($1, $2, 'PRESIDENT', 'ACTIVE', $2, NOW())`,
          [row.id, userId],
        );
        return row;
      });
    } catch (error) {
      if (isShortNameConflict(error)) {
        throw new ConflictException(`Ya existe un circuito con la sigla ${shortName}`);
      }
      throw error;
    }
    await this.seedDefaultPointRules(circuit.id);
    return circuit;
  }

  async update(circuitId: string, userId: string, dto: UpdateCircuitDto) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const sets: string[] = [];
    const params: unknown[] = [circuitId];
    for (const [key, column] of IDENTITY_COLUMNS) {
      const value = dto[key];
      if (value === undefined) continue;
      const normalized =
        key === 'shortName'
          ? normalizeShortName(value)
          : typeof value === 'string'
            ? value.trim() || null
            : value;
      if (key === 'name' && !normalized) {
        throw new BadRequestException('El nombre del circuito no puede quedar vacío');
      }
      params.push(normalized);
      sets.push(`${column} = $${params.length}`);
    }
    if (!sets.length) return this.getById(circuitId, userId);

    try {
      await this.db.query(
        `UPDATE circuits SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
        params,
      );
    } catch (error) {
      if (isShortNameConflict(error)) {
        throw new ConflictException(
          `Ya existe un circuito con la sigla ${normalizeShortName(dto.shortName)}`,
        );
      }
      throw error;
    }
    await this.audit.log(circuitId, userId, {
      action: 'circuit.update',
      entityType: 'circuit',
      entityId: circuitId,
      summary: 'Editó los datos del circuito',
      meta: { fields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined) },
    });
    return this.getById(circuitId, userId);
  }

  async uploadLogo(circuitId: string, userId: string, file: Express.Multer.File) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!file?.buffer?.length) throw new BadRequestException('Archivo requerido');
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }
    const upload = await uploadImageBuffer(file, `playtomic-clone/circuits/${circuitId}`, {
      width: 512,
      height: 512,
      crop: 'fill',
    });
    const result = await this.db.query(
      `UPDATE circuits SET logo_url = $2, updated_at = NOW() WHERE id = $1 RETURNING logo_url`,
      [circuitId, upload.secure_url],
    );
    return { logo_url: result.rows[0].logo_url };
  }

  /** Circuitos donde el usuario forma parte del staff activo, con su cargo. */
  async listMine(userId: string) {
    const result = await this.db.query(
      `SELECT c.*,
              cs.role AS my_role,
              cs.title AS my_title,
              (SELECT COUNT(*)::int FROM circuit_venues cv WHERE cv.circuit_id = c.id) AS venue_count,
              (SELECT COUNT(*)::int FROM circuit_categories cc WHERE cc.circuit_id = c.id) AS category_count,
              (
                SELECT MIN(st.start_date)
                FROM circuit_stages st
                WHERE st.circuit_id = c.id AND st.start_date >= NOW()
              ) AS next_stage_date
       FROM circuit_staff cs
       INNER JOIN circuits c ON c.id = cs.circuit_id
       WHERE cs.user_id = $1 AND cs.status = 'ACTIVE'
       ORDER BY
         CASE c.status WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
         c.created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      ...row,
      my_display_title: circuitDisplayTitle(row.my_role, row.my_title, row),
    }));
  }

  async getViewerAccess(circuitId: string, userId?: string | null) {
    const access = await this.access.getAccess(circuitId, userId);
    return {
      role: access.role,
      memberId: access.memberId,
      isSuperAdmin: access.isSuperAdmin,
      permissions: access.permissions,
    };
  }

  async getById(id: string, viewerId?: string | null) {
    const circuitResult = await this.db.query(`SELECT * FROM circuits WHERE id = $1`, [id]);
    const circuit = circuitResult.rows[0];
    if (!circuit) {
      throw new NotFoundException('Circuito no encontrado');
    }

    const [categories, venues, stages, rankings, pointRules, events, staff, viewer, news, sponsors] = await Promise.all([
      this.db.query(
        `SELECT id, circuit_id, label, gender, sort_order, kind, level, sum_total, created_at
         FROM circuit_categories
         WHERE circuit_id = $1
         ORDER BY sort_order ASC, label ASC`,
        [id],
      ),
      this.db.query(
        `SELECT cv.club_id, cl.name AS club_name, cl.city, cl.address,
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
      this.db.query(
        `SELECT e.id, e.name, e.start_date, e.end_date, e.schedule_status, e.primary_club_id,
                (SELECT COUNT(*)::int FROM circuit_stages cs WHERE cs.event_id = e.id) AS stage_count,
                (SELECT COUNT(*)::int FROM circuit_event_venues cev WHERE cev.event_id = e.id) AS venue_count
         FROM circuit_events e
         WHERE e.circuit_id = $1
         ORDER BY e.start_date DESC`,
        [id],
      ),
      this.staff.listStaff(id, viewerId),
      this.getViewerAccess(id, viewerId),
      this.db.query(
        `SELECT id, title, body, image_url, pinned, published_at
         FROM circuit_news
         WHERE circuit_id = $1
         ORDER BY pinned DESC, published_at DESC
         LIMIT 3`,
        [id],
      ),
      this.db.query(
        `SELECT id, name, logo_url, website, tier, sort_order
         FROM circuit_sponsors
         WHERE circuit_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
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
      events: events.rows,
      staff,
      viewer,
      news: news.rows,
      sponsors: sponsors.rows,
    };
  }

  async addCategory(circuitId: string, userId: string, dto: AddCircuitCategoryDto) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const parsed = parseCategoryLabel(dto.label);
    const kind = dto.kind ?? parsed.kind;
    const level = kind === 'FIXED' ? dto.level ?? parsed.level : null;
    const sumTotal = kind === 'SUM' ? dto.sumTotal ?? parsed.sumTotal : null;
    if (kind === 'FIXED' && level == null) {
      throw new BadRequestException('Indicá el nivel (1ra a 8va) de la categoría');
    }
    if (kind === 'SUM' && sumTotal == null) {
      throw new BadRequestException('Indicá la suma de la categoría (por ejemplo Suma 7)');
    }

    const result = await this.db.query(
      `INSERT INTO circuit_categories (circuit_id, label, gender, sort_order, kind, level, sum_total)
       VALUES ($1, $2, $3, COALESCE($4, 0), $5, $6, $7)
       RETURNING *`,
      [circuitId, dto.label.trim(), dto.gender ?? null, dto.sortOrder ?? null, kind, level, sumTotal],
    );
    await this.audit.log(circuitId, userId, {
      action: 'category.create',
      entityType: 'circuit_category',
      entityId: result.rows[0].id,
      summary: `Nueva categoría: ${[dto.gender, dto.label.trim()].filter(Boolean).join(' ')}`,
    });
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
   * Crea una “ETAPA”: evento multi-sede + una fila de stage por categoría.
   * Opcionalmente publica el torneo de cada categoría.
   */
  async createEvent(circuitId: string, userId: string, dto: CreateCircuitEventDto) {
    await this.assertCanManageCircuit(circuitId, userId);
    await this.ensureCircuit(circuitId);

    const venuesInput =
      dto.venues?.length
        ? dto.venues
        : dto.clubId
          ? [{ clubId: dto.clubId, courtsCount: 4, isPrimary: true }]
          : [];
    if (!venuesInput.length) {
      throw new BadRequestException('Indicá al menos una sede del evento');
    }

    for (const v of venuesInput) {
      const club = await this.db.query(`SELECT id, name FROM clubs WHERE id = $1`, [v.clubId]);
      if (!club.rows[0]) throw new NotFoundException(`Club no encontrado: ${v.clubId}`);
    }

    const primary =
      venuesInput.find((v) => v.isPrimary)?.clubId ?? venuesInput[0].clubId;

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

    for (const v of venuesInput) {
      await this.db.query(
        `INSERT INTO circuit_venues (circuit_id, club_id)
         VALUES ($1, $2)
         ON CONFLICT (circuit_id, club_id) DO NOTHING`,
        [circuitId, v.clubId],
      );
    }

    const eventRes = await this.db.query(
      `INSERT INTO circuit_events
         (circuit_id, name, start_date, end_date, primary_club_id, created_by_user_id,
          match_duration_minutes, day_start_hour, day_end_hour)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (circuit_id, name) DO UPDATE
         SET start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             primary_club_id = EXCLUDED.primary_club_id,
             match_duration_minutes = EXCLUDED.match_duration_minutes,
             day_start_hour = EXCLUDED.day_start_hour,
             day_end_hour = EXCLUDED.day_end_hour,
             updated_at = NOW()
       RETURNING *`,
      [
        circuitId,
        dto.name.trim(),
        dto.startDate,
        dto.endDate ?? null,
        primary,
        userId,
        dto.matchDurationMinutes ?? 90,
        dto.dayStartHour ?? 9,
        dto.dayEndHour ?? 22,
      ],
    );
    const event = eventRes.rows[0];

    await this.db.query(`DELETE FROM circuit_event_venues WHERE event_id = $1`, [event.id]);
    for (let i = 0; i < venuesInput.length; i++) {
      const v = venuesInput[i];
      await this.db.query(
        `INSERT INTO circuit_event_venues (event_id, club_id, courts_count, is_primary, sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          event.id,
          v.clubId,
          v.courtsCount ?? 2,
          v.clubId === primary,
          i,
        ],
      );
    }

    const createdStages: any[] = [];
    for (let i = 0; i < categories.rows.length; i++) {
      const cat = categories.rows[i];
      const stage = await this.db.query(
        `INSERT INTO circuit_stages
           (circuit_id, club_id, category_id, name, start_date, end_date, sort_order, status, event_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'SCHEDULED',$8)
         RETURNING *`,
        [
          circuitId,
          primary,
          cat.id,
          dto.name.trim(),
          dto.startDate,
          dto.endDate ?? null,
          i,
          event.id,
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

    await this.audit.log(circuitId, userId, {
      action: 'event.create',
      entityType: 'circuit_event',
      entityId: event.id,
      summary: `Creó la etapa ${event.name} con ${createdStages.length} categoría(s)`,
    });

    return {
      eventId: event.id,
      eventName: event.name,
      scheduleStatus: event.schedule_status,
      venues: venuesInput,
      stages: createdStages,
    };
  }

  async listEvents(circuitId: string) {
    await this.ensureCircuit(circuitId);
    const events = await this.db.query(
      `SELECT e.*,
              (SELECT COUNT(*)::int FROM circuit_stages cs WHERE cs.event_id = e.id) AS stage_count,
              (SELECT COUNT(*)::int FROM circuit_event_venues cev WHERE cev.event_id = e.id) AS venue_count
       FROM circuit_events e
       WHERE e.circuit_id = $1
       ORDER BY e.start_date DESC`,
      [circuitId],
    );
    return events.rows;
  }

  async getEvent(circuitId: string, eventId: string) {
    await this.ensureCircuit(circuitId);
    const event = await this.db.query(
      `SELECT * FROM circuit_events WHERE id = $1 AND circuit_id = $2`,
      [eventId, circuitId],
    );
    if (!event.rows[0]) throw new NotFoundException('Evento no encontrado');

    const realMatch = `tm.tournament_id = cs.tournament_id
                  AND COALESCE((tm.score->>'bye')::boolean, FALSE) = FALSE
                  AND tm.status <> 'CANCELLED'`;
    const [venues, stages, sponsors, byDay] = await Promise.all([
      this.db.query(
        `SELECT cev.club_id, cev.courts_count, cev.is_primary, cev.sort_order,
                cl.name AS club_name, cl.city, cl.address, cl.logo_url
         FROM circuit_event_venues cev
         INNER JOIN clubs cl ON cl.id = cev.club_id
         WHERE cev.event_id = $1
         ORDER BY cev.is_primary DESC, cev.sort_order ASC`,
        [eventId],
      ),
      this.db.query(
        `SELECT cs.*, cc.label AS category_label, cc.gender AS category_gender,
                cc.kind AS category_kind, cc.level AS category_level, cc.sum_total AS category_sum_total,
                t.status AS tournament_status, t.name AS tournament_name, t.max_teams,
                t.registration_closes_at, t.registration_closed_at,
                (SELECT COUNT(*)::int FROM tournament_registrations r
                  WHERE r.tournament_id = cs.tournament_id AND r.status = 'APPROVED') AS teams_approved,
                (SELECT COUNT(*)::int FROM tournament_registrations r
                  WHERE r.tournament_id = cs.tournament_id AND r.status = 'PENDING') AS teams_pending,
                (SELECT COUNT(*)::int FROM tournament_matches tm WHERE ${realMatch}) AS matches_count,
                (SELECT COUNT(*)::int FROM tournament_matches tm
                  WHERE ${realMatch} AND tm.status = 'FINISHED') AS matches_finished,
                (SELECT COUNT(DISTINCT tm.group_name)::int FROM tournament_matches tm
                  WHERE tm.tournament_id = cs.tournament_id AND tm.phase = 'GROUP') AS groups_count,
                (SELECT CASE WHEN tm.winner_registration_id = tm.team_a_registration_id
                             THEN tm.team_a_name ELSE tm.team_b_name END
                 FROM tournament_matches tm
                 WHERE tm.tournament_id = cs.tournament_id AND tm.phase = 'KNOCKOUT'
                   AND tm.next_match_id IS NULL AND tm.status = 'FINISHED'
                 LIMIT 1) AS champion_name
         FROM circuit_stages cs
         LEFT JOIN circuit_categories cc ON cc.id = cs.category_id
         LEFT JOIN tournaments t ON t.id = cs.tournament_id
         WHERE cs.event_id = $1
         ORDER BY cs.sort_order ASC`,
        [eventId],
      ),
      this.db.query(
        `SELECT id, name, logo_url, website, tier
         FROM circuit_sponsors WHERE circuit_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [circuitId],
      ),
      this.db.query(
        `SELECT to_char(tm.scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE tm.status = 'FINISHED')::int AS finished
         FROM tournament_matches tm
         INNER JOIN circuit_stages cs ON cs.tournament_id = tm.tournament_id
         WHERE cs.event_id = $1 AND tm.scheduled_at IS NOT NULL AND tm.schedule_published = TRUE
           AND tm.status <> 'CANCELLED'
         GROUP BY 1 ORDER BY 1`,
        [eventId],
      ),
    ]);

    const totals = stages.rows.reduce(
      (acc, s) => ({
        teams: acc.teams + Number(s.teams_approved || 0),
        matches: acc.matches + Number(s.matches_count || 0),
        finished: acc.finished + Number(s.matches_finished || 0),
      }),
      { teams: 0, matches: 0, finished: 0 },
    );

    return {
      ...event.rows[0],
      venues: venues.rows,
      stages: stages.rows,
      sponsors: sponsors.rows,
      matches_by_day: byDay.rows,
      totals,
    };
  }

  async setRegistrationAvailability(
    tournamentId: string,
    registrationId: string,
    userId: string,
    slots: Array<{
      dayDate: string;
      startHour: number;
      endHour: number;
      preferredClubId?: string;
    }>,
  ) {
    const reg = await this.db.query(
      `SELECT id, player1_user_id, player2_user_id, created_by_user_id, tournament_id
       FROM tournament_registrations WHERE id = $1 AND tournament_id = $2`,
      [registrationId, tournamentId],
    );
    if (!reg.rows[0]) throw new NotFoundException('Inscripción no encontrada');
    const row = reg.rows[0];
    const allowed =
      row.player1_user_id === userId ||
      row.player2_user_id === userId ||
      row.created_by_user_id === userId;
    if (!allowed) {
      const role = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
      if (role.rows[0]?.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('No podés editar esta disponibilidad');
      }
    }

    await this.db.query(
      `DELETE FROM tournament_registration_availability WHERE registration_id = $1`,
      [registrationId],
    );
    for (const slot of slots) {
      if (slot.endHour <= slot.startHour) {
        throw new BadRequestException('Franja inválida');
      }
      await this.db.query(
        `INSERT INTO tournament_registration_availability
           (registration_id, day_date, start_hour, end_hour, preferred_club_id)
         VALUES ($1,$2::date,$3,$4,$5)`,
        [
          registrationId,
          slot.dayDate,
          slot.startHour,
          slot.endHour,
          slot.preferredClubId ?? null,
        ],
      );
    }
    const saved = await this.db.query(
      `SELECT id, day_date, start_hour, end_hour, preferred_club_id
       FROM tournament_registration_availability
       WHERE registration_id = $1
       ORDER BY day_date, start_hour`,
      [registrationId],
    );
    return saved.rows;
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
    await this.audit.log(circuitId, userId, {
      action: 'points.update',
      summary: 'Actualizó la tabla de puntos del ranking',
    });
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
    await this.audit.log(circuitId, userId, {
      action: 'circuit.publish',
      entityType: 'circuit',
      entityId: circuitId,
      summary: 'Publicó el circuito',
    });
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
    const knockout = matches.rows.filter((m: any) => m.phase === 'KNOCKOUT');
    const hasBracket = matches.rows.some((m: any) => m.next_match_id || /final|semi|cuartos/i.test(m.round_label || ''));

    if (knockout.length) {
      const finalRound = Math.max(...knockout.map((m: any) => Number(m.round) || 0));
      for (const m of knockout) {
        if (m.score?.bye) continue;
        const winner = m.winner_registration_id as string | null;
        if (!winner) continue;
        const loser =
          m.team_a_registration_id === winner ? m.team_b_registration_id : m.team_a_registration_id;
        const fromFinal = finalRound - (Number(m.round) || 0);
        if (fromFinal === 0) placementByReg.set(winner, 'WINNER');
        if (loser && !placementByReg.has(loser)) {
          placementByReg.set(loser, knockoutLoserPlacement(fromFinal));
        }
      }
      const groupTeams = new Set<string>();
      for (const m of matches.rows) {
        if (m.phase !== 'GROUP') continue;
        if (m.team_a_registration_id) groupTeams.add(m.team_a_registration_id);
        if (m.team_b_registration_id) groupTeams.add(m.team_b_registration_id);
      }
      for (const regId of groupTeams) {
        if (!placementByReg.has(regId)) placementByReg.set(regId, 'GROUP_ELIMINATED');
      }
    } else if (hasBracket) {
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
      // Round robin / standings: top positions map to circuit placements
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
    await this.access.assert(
      circuitId,
      userId,
      'circuit.edit',
      'Solo el Presidente o un Organizador del circuito pueden realizar esta acción',
    );
  }
}
