import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { isClubRole } from '../common/roles';
import { getMonthKey } from '../common/utils';
import { COURT_SLOT_END_AT_SQL } from '../common/utils/court-schedule.util';
import { deleteCloudinaryAsset, uploadImageBuffer } from '../common/cloudinary/cloudinary.util';
import { DatabaseService } from '../database/database.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateClubDto } from './dto/create-club.dto';
import { CreateClubPromotionDto } from './dto/create-club-promotion.dto';
import { CreateClubRewardDto } from './dto/create-club-reward.dto';
import { CreateShopCouponDto } from './dto/create-shop-coupon.dto';
import { CreateShopProductDto } from './dto/create-shop-product.dto';
import { UpdateShopProductDto } from './dto/update-shop-product.dto';
import { UpdateClubRewardDto } from './dto/update-club-reward.dto';
import { UpdateShopStockDto } from './dto/update-shop-stock.dto';

type RankingPeriod = 'weekly' | 'monthly' | 'annual';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreateCourtScheduleDto } from './dto/create-court-schedule.dto';
import { CreateCourtSlotDto } from './dto/create-court-slot.dto';
import { GenerateCourtSlotsDto } from './dto/generate-court-slots.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { UpdateCourtScheduleDto } from './dto/update-court-schedule.dto';
import { UpdateCourtSlotDto } from './dto/update-court-slot.dto';
import { UpdateClubDto } from './dto/update-club.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertClubId(id: string): void {
  if (!id || id === 'undefined' || id === 'null' || !UUID_RE.test(id)) {
    throw new BadRequestException('ID de club inválido');
  }
}

@Injectable()
export class ClubsService {
  constructor(
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  async findAll() {
    const result = await this.db.query(
      `SELECT id, name, city, zone, address, phone, logo_url, cover_url, latitude, longitude,
              subscription_plan, created_at
       FROM clubs
       ORDER BY name ASC`,
    );
    return result.rows;
  }

  /**
   * Listado de clubs según el viewer:
   * - CLUB_ADMIN → solo sedes en club_admins
   * - resto / anónimo → todos (descubrimiento de jugadores)
   */
  async findAllForViewer(userId?: string | null) {
    if (!userId) {
      return this.findAll();
    }
    const roleResult = await this.db.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [userId],
    );
    const role = roleResult.rows[0]?.role;
    if (role === 'CLUB_ADMIN') {
      return this.findMine(userId);
    }
    return this.findAll();
  }

  /** Clubs/sedes asociados al usuario (club_admins). SUPER_ADMIN ve todos. */
  async findMine(userId: string) {
    const roleResult = await this.db.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [userId],
    );
    const role = roleResult.rows[0]?.role;
    if (role === 'SUPER_ADMIN') {
      return this.findAll();
    }

    const result = await this.db.query(
      `SELECT c.id, c.name, c.city, c.zone, c.address, c.phone, c.logo_url, c.cover_url,
              c.latitude, c.longitude, c.subscription_plan, c.created_at
       FROM clubs c
       INNER JOIN club_admins ca ON ca.club_id = c.id
       WHERE ca.user_id = $1
       ORDER BY c.name ASC`,
      [userId],
    );
    return result.rows;
  }

  /**
   * Clubs con al menos un turno OPEN que se solapa con la franja pedida.
   */
  async findAvailableForWindow(date: string, startHour: number, endHour: number) {
    if (!date || Number.isNaN(startHour) || Number.isNaN(endHour) || startHour >= endHour) {
      throw new BadRequestException('Fecha y franja horaria inválidas');
    }

    await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'CANCELLED'
       WHERE status = 'OPEN' AND ${COURT_SLOT_END_AT_SQL} < NOW()`,
    );

    const result = await this.db.query(
      `SELECT c.id,
              c.name,
              c.city,
              c.zone,
              c.address,
              cas.id AS slot_id,
              cas.court_label,
              cas.start_hour,
              cas.end_hour,
              cas.bonus_points,
              cas.price_per_hour
       FROM clubs c
       INNER JOIN court_availability_slots cas ON cas.club_id = c.id
       WHERE cas.status = 'OPEN'
         AND cas.slot_date = $1::date
         AND cas.start_hour < $3
         AND cas.end_hour > $2
       ORDER BY c.name ASC, cas.start_hour ASC, cas.court_label ASC`,
      [date, startHour, endHour],
    );

    const byClub = new Map<
      string,
      {
        id: string;
        name: string;
        city?: string;
        zone?: string;
        address?: string;
        openSlots: number;
        slots: {
          id: string;
          courtLabel: string;
          startHour: number;
          endHour: number;
          bonusPoints: number;
          pricePerHour: number | null;
        }[];
      }
    >();

    for (const row of result.rows) {
      let club = byClub.get(row.id);
      if (!club) {
        club = {
          id: row.id,
          name: row.name,
          city: row.city ?? undefined,
          zone: row.zone ?? undefined,
          address: row.address ?? undefined,
          openSlots: 0,
          slots: [],
        };
        byClub.set(row.id, club);
      }
      club.openSlots += 1;
      club.slots.push({
        id: row.slot_id,
        courtLabel: row.court_label,
        startHour: Number(row.start_hour),
        endHour: Number(row.end_hour),
        bonusPoints: Number(row.bonus_points ?? 0),
        pricePerHour: row.price_per_hour != null ? Number(row.price_per_hour) : null,
      });
    }

    return Array.from(byClub.values());
  }

  async findOne(id: string) {
    assertClubId(id);
    const result = await this.db.query(
      `SELECT id, name, city, zone, address, phone, email, description, logo_url, cover_url, latitude, longitude,
              subscription_plan, auto_fill_gaps_enabled, court_price_per_hour, deposit_percent,
              gap_fill_hours_before, gap_fill_auto_create_match, gap_fill_notify_enabled,
              created_at, updated_at
       FROM clubs
       WHERE id = $1`,
      [id],
    );
    const club = result.rows[0];

    if (!club) {
      throw new NotFoundException('Club no encontrado');
    }

    return {
      ...club,
      autoFillGapsEnabled: Boolean(club.auto_fill_gaps_enabled),
      courtPricePerHour: Number(club.court_price_per_hour ?? 0),
      depositPercent: Number(club.deposit_percent ?? 0),
      gapFillHoursBefore: Number(club.gap_fill_hours_before ?? 8),
      gapFillAutoCreateMatch: Boolean(club.gap_fill_auto_create_match),
      gapFillNotifyEnabled: club.gap_fill_notify_enabled !== false,
    };
  }

  async create(userId: string, dto: CreateClubDto) {
    await this.assertClubRole(userId);
    const result = await this.db.query(
      `INSERT INTO clubs (name, city, zone, address, phone, logo_url, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, city, zone, address, phone, logo_url, latitude, longitude,
                 created_at, updated_at`,
      [
        dto.name,
        dto.city ?? null,
        dto.zone ?? null,
        dto.address ?? null,
        dto.phone ?? null,
        dto.logoUrl ?? null,
        dto.latitude ?? null,
        dto.longitude ?? null,
      ],
    );
    const club = result.rows[0];
    await this.db.query(
      `INSERT INTO club_admins (club_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [club.id, userId],
    );
    return club;
  }

  async isClubAdminOf(clubId: string, userId: string): Promise<boolean> {
    const roleResult = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = roleResult.rows[0]?.role;
    if (role === 'SUPER_ADMIN') return true;
    const result = await this.db.query(
      `SELECT 1 FROM club_admins WHERE club_id = $1 AND user_id = $2 LIMIT 1`,
      [clubId, userId],
    );
    return Boolean(result.rows[0]);
  }

  async assertClubAdminOf(clubId: string, userId: string) {
    assertClubId(clubId);
    if (!(await this.isClubAdminOf(clubId, userId))) {
      throw new ForbiddenException('Solo admins de este club pueden realizar esta acción');
    }
  }

  async update(userId: string, clubId: string, dto: UpdateClubDto) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE clubs
       SET name = COALESCE($2, name),
           city = COALESCE($3, city),
           zone = COALESCE($4, zone),
           address = COALESCE($5, address),
           phone = COALESCE($6, phone),
           logo_url = COALESCE($7, logo_url),
           subscription_plan = COALESCE($8, subscription_plan),
           latitude = COALESCE($9, latitude),
           longitude = COALESCE($10, longitude),
           court_price_per_hour = COALESCE($11, court_price_per_hour),
           deposit_percent = COALESCE($12, deposit_percent),
           email = COALESCE($13, email),
           description = COALESCE($14, description),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, city, zone, address, phone, email, description, logo_url, latitude, longitude,
                 subscription_plan, auto_fill_gaps_enabled, court_price_per_hour, deposit_percent,
                 created_at, updated_at`,
      [
        clubId,
        dto.name ?? null,
        dto.city ?? null,
        dto.zone ?? null,
        dto.address ?? null,
        dto.phone ?? null,
        dto.logoUrl ?? null,
        dto.subscriptionPlan ?? null,
        dto.latitude ?? null,
        dto.longitude ?? null,
        dto.courtPricePerHour ?? null,
        dto.depositPercent ?? null,
        dto.email ?? null,
        dto.description ?? null,
      ],
    );
    const club = result.rows[0];
    if (!club) {
      throw new NotFoundException('Club no encontrado');
    }
    return {
      ...club,
      autoFillGapsEnabled: Boolean(club.auto_fill_gaps_enabled),
      courtPricePerHour: Number(club.court_price_per_hour ?? 0),
      depositPercent: Number(club.deposit_percent ?? 0),
    };
  }

  async uploadLogo(userId: string, clubId: string, file: Express.Multer.File) {
    await this.assertClubRole(userId, clubId);
    assertClubId(clubId);

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }

    const current = await this.db.query(`SELECT logo_url FROM clubs WHERE id = $1`, [clubId]);
    const club = current.rows[0];
    if (!club) {
      throw new NotFoundException('Club no encontrado');
    }

    const previousLogoUrl = club.logo_url as string | undefined;
    const upload = await uploadImageBuffer(file, `playtomic-clone/clubs/${clubId}`);

    const result = await this.db.query(
      `UPDATE clubs
       SET logo_url = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, city, zone, address, phone, logo_url, latitude, longitude,
                 subscription_plan, created_at, updated_at`,
      [clubId, upload.secure_url],
    );

    if (previousLogoUrl && previousLogoUrl !== upload.secure_url) {
      await deleteCloudinaryAsset(previousLogoUrl);
    }

    return result.rows[0];
  }

  async uploadCover(userId: string, clubId: string, file: Express.Multer.File) {
    await this.assertClubRole(userId, clubId);
    assertClubId(clubId);

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }

    const current = await this.db.query(`SELECT cover_url FROM clubs WHERE id = $1`, [clubId]);
    const club = current.rows[0];
    if (!club) {
      throw new NotFoundException('Club no encontrado');
    }

    const previousCoverUrl = club.cover_url as string | undefined;
    const upload = await uploadImageBuffer(file, `playtomic-clone/clubs/${clubId}/cover`);

    const result = await this.db.query(
      `UPDATE clubs
       SET cover_url = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, city, zone, address, phone, logo_url, cover_url, latitude, longitude,
                 subscription_plan, created_at, updated_at`,
      [clubId, upload.secure_url],
    );

    if (previousCoverUrl && previousCoverUrl !== upload.secure_url) {
      await deleteCloudinaryAsset(previousCoverUrl);
    }

    return result.rows[0];
  }

  async listCourtSlots(clubId: string, userId?: string) {
    await this.findOne(clubId);
    if (userId) {
      await this.assertClubRole(userId, clubId);
    }
    await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'CANCELLED'
       WHERE club_id = $1 AND status = 'OPEN' AND ${COURT_SLOT_END_AT_SQL} < NOW()`,
      [clubId],
    );
    const result = await this.db.query(
      `SELECT id, club_id, court_id, court_label, slot_date, start_hour, end_hour, status, bonus_points, price_per_hour, created_at
       FROM court_availability_slots
       WHERE club_id = $1 AND status <> 'CANCELLED'
       ORDER BY slot_date ASC, start_hour ASC`,
      [clubId],
    );
    return result.rows;
  }

  async listClubMatches(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);
    const result = await this.db.query(
      `SELECT m.id,
              m.title,
              m.date,
              m.status,
              m.needed_players,
              (
                (SELECT COUNT(*)::int FROM match_players mp WHERE mp.match_id = m.id AND mp.status IN ('JOINED','CONFIRMED'))
                +
                (SELECT COUNT(*)::int FROM match_guests mg WHERE mg.match_id = m.id)
              ) AS joined_count
       FROM matches m
       WHERE m.club_id = $1
         AND m.status NOT IN ('CANCELLED', 'FINISHED')
         AND m.date >= NOW() - INTERVAL '12 hours'
       ORDER BY m.date ASC
       LIMIT 40`,
      [clubId],
    );
    return result.rows;
  }

  async createCourtSlot(userId: string, clubId: string, dto: CreateCourtSlotDto) {
    await this.assertClubRole(userId, clubId);
    const club = await this.findOne(clubId);

    if (dto.startHour >= dto.endHour) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }

    const court = await this.resolveCourtForSlot(clubId, dto.courtId, dto.courtLabel);
    if (!court.active) {
      throw new BadRequestException('La cancha está deshabilitada');
    }

    const bonusPoints = await this.resolveSlotBonus(clubId, dto);
    const pricePerHour = this.resolveSlotPricePerHour(club, dto.pricePerHour);

    const result = await this.db.query(
      `INSERT INTO court_availability_slots
         (club_id, court_id, court_label, slot_date, start_hour, end_hour, created_by_user_id, bonus_points, price_per_hour)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9)
       RETURNING id, club_id, court_id, court_label, slot_date, start_hour, end_hour, status, bonus_points, price_per_hour, created_at`,
      [clubId, court.id, court.name, dto.slotDate, dto.startHour, dto.endHour, userId, bonusPoints, pricePerHour],
    );
    const slot = result.rows[0];

    let notifiedCount = 0;
    if (dto.notifyPlayers !== false) {
      notifiedCount = await this.notifyPlayersAboutSlot(club, slot);
    }

    return { ...slot, notifiedCount };
  }

  async updateCourtSlot(userId: string, clubId: string, slotId: string, dto: UpdateCourtSlotDto) {
    await this.assertClubRole(userId, clubId);
    const existing = await this.db.query(
      `SELECT id, court_id, court_label, slot_date, start_hour, end_hour, price_per_hour
       FROM court_availability_slots
       WHERE id = $1 AND club_id = $2 AND status <> 'CANCELLED'`,
      [slotId, clubId],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundException('Horario no encontrado');
    }

    const club = await this.findOne(clubId);
    const court = await this.resolveCourtForSlot(
      clubId,
      dto.courtId ?? row.court_id,
      dto.courtLabel ?? row.court_label,
    );
    if (!court.active) {
      throw new BadRequestException('La cancha está deshabilitada');
    }

    const slotDate = dto.slotDate ?? row.slot_date;
    const startHour = dto.startHour ?? Number(row.start_hour);
    const endHour = dto.endHour ?? Number(row.end_hour);

    if (startHour >= endHour) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }

    const bonusPoints = await this.resolveSlotBonus(clubId, {
      slotDate: typeof slotDate === 'string' ? slotDate.slice(0, 10) : slotDate,
      startHour,
      endHour,
    });

    const pricePerHour =
      dto.pricePerHour !== undefined
        ? this.resolveSlotPricePerHour(club, dto.pricePerHour)
        : row.price_per_hour != null
          ? Number(row.price_per_hour)
          : this.resolveSlotPricePerHour(club, undefined);

    const result = await this.db.query(
      `UPDATE court_availability_slots
       SET court_id = $3,
           court_label = $4,
           slot_date = $5::date,
           start_hour = $6,
           end_hour = $7,
           bonus_points = $8,
           price_per_hour = $9
       WHERE id = $1 AND club_id = $2
       RETURNING id, club_id, court_id, court_label, slot_date, start_hour, end_hour, status, bonus_points, price_per_hour, created_at`,
      [slotId, clubId, court.id, court.name, slotDate, startHour, endHour, bonusPoints, pricePerHour],
    );
    return result.rows[0];
  }

  async listCourts(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);
    const result = await this.db.query(
      `SELECT c.id, c.club_id, c.name, c.active, c.has_fixed_schedule, c.sort_order, c.created_at, c.updated_at,
              (
                SELECT COUNT(*)::int FROM court_schedules cs
                WHERE cs.court_id = c.id AND cs.active = TRUE
              ) AS schedules_count
       FROM courts c
       WHERE c.club_id = $1
       ORDER BY c.sort_order ASC, c.name ASC`,
      [clubId],
    );
    return result.rows;
  }

  async createCourt(clubId: string, userId: string, dto: CreateCourtDto) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Indicá el nombre de la cancha');
    }

    try {
      const result = await this.db.query(
        `INSERT INTO courts (club_id, name, active, has_fixed_schedule, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, club_id, name, active, has_fixed_schedule, sort_order, created_at, updated_at`,
        [
          clubId,
          name,
          dto.active ?? true,
          dto.hasFixedSchedule ?? false,
          dto.sortOrder ?? 0,
        ],
      );
      return result.rows[0];
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Ya existe una cancha con ese nombre');
      }
      throw err;
    }
  }

  async updateCourt(clubId: string, userId: string, courtId: string, dto: UpdateCourtDto) {
    await this.assertClubRole(userId, clubId);
    const existing = await this.getCourtOrThrow(clubId, courtId);

    const name = dto.name != null ? dto.name.trim() : existing.name;
    if (!name) {
      throw new BadRequestException('Indicá el nombre de la cancha');
    }

    const active = dto.active ?? existing.active;
    const hasFixedSchedule = dto.hasFixedSchedule ?? existing.has_fixed_schedule;
    const sortOrder = dto.sortOrder ?? existing.sort_order;

    let result;
    try {
      result = await this.db.query(
        `UPDATE courts
         SET name = $3,
             active = $4,
             has_fixed_schedule = $5,
             sort_order = $6,
             updated_at = NOW()
         WHERE id = $1 AND club_id = $2
         RETURNING id, club_id, name, active, has_fixed_schedule, sort_order, created_at, updated_at`,
        [courtId, clubId, name, active, hasFixedSchedule, sortOrder],
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Ya existe una cancha con ese nombre');
      }
      throw err;
    }

    const court = result.rows[0];
    if (!court) {
      throw new NotFoundException('Cancha no encontrada');
    }

    if (name !== existing.name) {
      await this.db.query(
        `UPDATE court_availability_slots
         SET court_label = $3
         WHERE court_id = $1 AND club_id = $2 AND status <> 'CANCELLED'`,
        [courtId, clubId, name],
      );
    }

    if (existing.active && !active) {
      await this.db.query(
        `UPDATE court_availability_slots
         SET status = 'CANCELLED'
         WHERE court_id = $1 AND club_id = $2 AND status = 'OPEN'
           AND slot_date >= CURRENT_DATE`,
        [courtId, clubId],
      );
    }

    return court;
  }

  async deleteCourt(clubId: string, userId: string, courtId: string) {
    await this.assertClubRole(userId, clubId);
    await this.getCourtOrThrow(clubId, courtId);

    const booked = await this.db.query(
      `SELECT id FROM court_availability_slots
       WHERE court_id = $1 AND club_id = $2 AND status = 'BOOKED'
       LIMIT 1`,
      [courtId, clubId],
    );
    if (booked.rows[0]) {
      throw new BadRequestException(
        'No se puede eliminar: hay turnos reservados. Deshabilitá la cancha en su lugar.',
      );
    }

    await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'CANCELLED'
       WHERE court_id = $1 AND club_id = $2 AND status = 'OPEN'`,
      [courtId, clubId],
    );

    await this.db.query(`DELETE FROM courts WHERE id = $1 AND club_id = $2`, [courtId, clubId]);
    return { ok: true };
  }

  async listCourtSchedules(clubId: string, userId: string, courtId: string) {
    await this.assertClubRole(userId, clubId);
    await this.getCourtOrThrow(clubId, courtId);
    const result = await this.db.query(
      `SELECT id, court_id, day_of_week, start_hour, end_hour, active, created_at
       FROM court_schedules
       WHERE court_id = $1
       ORDER BY day_of_week ASC, start_hour ASC`,
      [courtId],
    );
    return result.rows;
  }

  async createCourtSchedule(
    clubId: string,
    userId: string,
    courtId: string,
    dto: CreateCourtScheduleDto,
  ) {
    await this.assertClubRole(userId, clubId);
    await this.getCourtOrThrow(clubId, courtId);

    if (dto.startHour >= dto.endHour) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }

    try {
      const result = await this.db.query(
        `INSERT INTO court_schedules (court_id, day_of_week, start_hour, end_hour, active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, court_id, day_of_week, start_hour, end_hour, active, created_at`,
        [courtId, dto.dayOfWeek, dto.startHour, dto.endHour, dto.active ?? true],
      );

      await this.db.query(
        `UPDATE courts SET has_fixed_schedule = TRUE, updated_at = NOW() WHERE id = $1`,
        [courtId],
      );

      return result.rows[0];
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Ese horario fijo ya existe para este día');
      }
      throw err;
    }
  }

  async updateCourtSchedule(
    clubId: string,
    userId: string,
    courtId: string,
    scheduleId: string,
    dto: UpdateCourtScheduleDto,
  ) {
    await this.assertClubRole(userId, clubId);
    await this.getCourtOrThrow(clubId, courtId);

    const existing = await this.db.query(
      `SELECT id, day_of_week, start_hour, end_hour, active
       FROM court_schedules WHERE id = $1 AND court_id = $2`,
      [scheduleId, courtId],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundException('Horario fijo no encontrado');
    }

    const dayOfWeek = dto.dayOfWeek ?? row.day_of_week;
    const startHour = dto.startHour ?? Number(row.start_hour);
    const endHour = dto.endHour ?? Number(row.end_hour);
    const active = dto.active ?? row.active;

    if (startHour >= endHour) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }

    try {
      const result = await this.db.query(
        `UPDATE court_schedules
         SET day_of_week = $3, start_hour = $4, end_hour = $5, active = $6
         WHERE id = $1 AND court_id = $2
         RETURNING id, court_id, day_of_week, start_hour, end_hour, active, created_at`,
        [scheduleId, courtId, dayOfWeek, startHour, endHour, active],
      );
      return result.rows[0];
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Ese horario fijo ya existe para este día');
      }
      throw err;
    }
  }

  async deleteCourtSchedule(clubId: string, userId: string, courtId: string, scheduleId: string) {
    await this.assertClubRole(userId, clubId);
    await this.getCourtOrThrow(clubId, courtId);

    const result = await this.db.query(
      `DELETE FROM court_schedules WHERE id = $1 AND court_id = $2 RETURNING id`,
      [scheduleId, courtId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Horario fijo no encontrado');
    }

    const remaining = await this.db.query(
      `SELECT id FROM court_schedules WHERE court_id = $1 AND active = TRUE LIMIT 1`,
      [courtId],
    );
    if (!remaining.rows[0]) {
      await this.db.query(
        `UPDATE courts SET has_fixed_schedule = FALSE, updated_at = NOW() WHERE id = $1`,
        [courtId],
      );
    }

    return { ok: true };
  }

  /**
   * Materializa turnos OPEN a partir de los horarios fijos activos de la cancha.
   * Usa court_duration_hours del club (default 1.5h) para partir cada franja.
   */
  async generateSlotsFromSchedules(
    clubId: string,
    userId: string,
    courtId: string,
    dto: GenerateCourtSlotsDto,
  ) {
    await this.assertClubRole(userId, clubId);
    const court = await this.getCourtOrThrow(clubId, courtId);

    if (!court.active) {
      throw new BadRequestException('La cancha está deshabilitada');
    }

    const schedules = await this.db.query(
      `SELECT day_of_week, start_hour, end_hour
       FROM court_schedules
       WHERE court_id = $1 AND active = TRUE
       ORDER BY day_of_week ASC, start_hour ASC`,
      [courtId],
    );
    if (!schedules.rows.length) {
      throw new BadRequestException('Configurá al menos un horario fijo activo');
    }

    const clubMeta = await this.db.query(
      `SELECT COALESCE(court_duration_hours, 1.5)::float AS duration,
              COALESCE(court_price_per_hour, 0)::float8 AS court_price_per_hour
       FROM clubs WHERE id = $1`,
      [clubId],
    );
    const duration = Number(clubMeta.rows[0]?.duration) || 1.5;
    const clubPrice = {
      courtPricePerHour: Number(clubMeta.rows[0]?.court_price_per_hour ?? 0),
    };
    const daysAhead = dto.daysAhead ?? 7;

    let created = 0;
    let skipped = 0;
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    for (let offset = 0; offset < daysAhead; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const dayOfWeek = date.getDay();
      const slotDate = date.toISOString().slice(0, 10);

      const daySchedules = schedules.rows.filter((s) => Number(s.day_of_week) === dayOfWeek);
      for (const schedule of daySchedules) {
        const windowStart = Number(schedule.start_hour);
        const windowEnd = Number(schedule.end_hour);

        for (let start = windowStart; start + duration <= windowEnd + 1e-9; start += duration) {
          const end = Math.round((start + duration) * 10) / 10;
          if (end > windowEnd + 1e-9) break;

          const overlap = await this.db.query(
            `SELECT id FROM court_availability_slots
             WHERE club_id = $1
               AND status <> 'CANCELLED'
               AND slot_date = $2::date
               AND (
                 (court_id = $3)
                 OR (court_id IS NULL AND TRIM(court_label) = $4)
               )
               AND start_hour < $6
               AND end_hour > $5
             LIMIT 1`,
            [clubId, slotDate, courtId, court.name, start, end],
          );

          if (overlap.rows[0]) {
            skipped += 1;
            continue;
          }

          const bonusPoints = await this.resolveSlotBonus(clubId, {
            slotDate,
            startHour: start,
            endHour: end,
          });
          const pricePerHour = this.resolveSlotPricePerHour(clubPrice, undefined);

          await this.db.query(
            `INSERT INTO court_availability_slots
               (club_id, court_id, court_label, slot_date, start_hour, end_hour, created_by_user_id, bonus_points, price_per_hour)
             VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9)`,
            [clubId, courtId, court.name, slotDate, start, end, userId, bonusPoints, pricePerHour],
          );
          created += 1;
        }
      }
    }

    if (!court.has_fixed_schedule) {
      await this.db.query(
        `UPDATE courts SET has_fixed_schedule = TRUE, updated_at = NOW() WHERE id = $1`,
        [courtId],
      );
    }

    return { created, skipped, daysAhead, duration };
  }

  async deleteCourtSlot(userId: string, clubId: string, slotId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE court_availability_slots
       SET status = 'CANCELLED'
       WHERE id = $1 AND club_id = $2
       RETURNING id`,
      [slotId, clubId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Horario no encontrado');
    }
    return { ok: true };
  }

  private async notifyPlayersAboutSlot(
    club: { id: string; name: string; city?: string; zone?: string },
    slot: {
      id: string;
      court_label: string;
      slot_date: string;
      start_hour: number;
      end_hour: number;
      bonus_points?: number;
      price_per_hour?: number | null;
    },
  ): Promise<number> {
    const startLabel = this.formatHourLabel(slot.start_hour);
    const endLabel = this.formatHourLabel(slot.end_hour);
    const dateLabel = new Date(`${slot.slot_date}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });

    const players = await this.db.query<{ id: string }>(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN players p ON p.user_id = u.id
       CROSS JOIN clubs c
       WHERE c.id = $1
         AND u.role = 'PLAYER'
         AND (
           p.city = c.city
           OR (c.zone IS NOT NULL AND p.zone = c.zone)
         )`,
      [club.id],
    );

    const bonus = (slot as { bonus_points?: number }).bonus_points ?? 0;
    const pricePerHour = slot.price_per_hour != null ? Number(slot.price_per_hour) : null;
    const duration = Number(slot.end_hour) - Number(slot.start_hour);
    const total =
      pricePerHour != null && pricePerHour > 0 && duration > 0
        ? Math.round(pricePerHour * duration)
        : null;
    const pricePart =
      pricePerHour != null && pricePerHour > 0
        ? ` · $${Math.round(pricePerHour).toLocaleString('es-AR')}/h${
            total != null ? ` (≈$${total.toLocaleString('es-AR')})` : ''
          }`
        : '';
    const title =
      bonus > 0 ? `Horario con bonus (+${bonus} pts) · ${club.name}` : `Cancha libre en ${club.name}`;
    const body = `${slot.court_label} · ${dateLabel} ${startLabel}–${endLabel}${pricePart}${
      bonus > 0 ? ' · Sumá puntos del club' : ''
    }`;

    for (const player of players.rows) {
      await this.db.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'COURT_SLOT_AVAILABLE', $2, $3, $4::jsonb)`,
        [
          player.id,
          title,
          body,
          JSON.stringify({
            clubId: club.id,
            slotId: slot.id,
            slotDate: slot.slot_date,
            startHour: slot.start_hour,
            endHour: slot.end_hour,
            pricePerHour,
            estimatedTotal: total,
          }),
        ],
      );
    }

    return players.rows.length;
  }

  async getDashboard(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    const club = await this.findOne(clubId);

    const [slots, activity, leaderboard] = await Promise.all([
      this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'OPEN' AND slot_date >= CURRENT_DATE)::int AS open_slots,
           COUNT(*) FILTER (WHERE slot_date >= CURRENT_DATE AND slot_date < CURRENT_DATE + 7)::int AS slots_this_week,
           COALESCE(SUM(bonus_points) FILTER (WHERE status = 'OPEN'), 0)::int AS bonus_points_offered
         FROM court_availability_slots
         WHERE club_id = $1 AND status <> 'CANCELLED'`,
        [clubId],
      ),
      this.db.query(
        `SELECT
           COUNT(DISTINCT mp.player_id) FILTER (
             WHERE m.date >= NOW() - INTERVAL '30 days'
           )::int AS unique_players_30d,
           COUNT(DISTINCT m.id) FILTER (
             WHERE m.status = 'FINISHED' AND m.date >= NOW() - INTERVAL '30 days'
           )::int AS matches_finished_30d,
           COUNT(DISTINCT m.id) FILTER (
             WHERE m.status IN ('OPEN','FULL','CONFIRMED','IN_PROGRESS')
               AND m.date >= NOW()
           )::int AS active_matches
         FROM matches m
         LEFT JOIN match_players mp ON mp.match_id = m.id AND mp.status IN ('JOINED','CONFIRMED')
         WHERE m.club_id = $1`,
        [clubId],
      ),
      this.queryMonthlyLeaderboard(clubId, 5),
    ]);

    const uniquePlayers = activity.rows[0]?.unique_players_30d ?? 0;
    const finishedMatches = activity.rows[0]?.matches_finished_30d ?? 0;
    const rotationIndex =
      finishedMatches > 0
        ? Math.min(100, Math.round((uniquePlayers / finishedMatches) * 100))
        : 0;

    return {
      openSlots: slots.rows[0]?.open_slots ?? 0,
      slotsThisWeek: slots.rows[0]?.slots_this_week ?? 0,
      bonusPointsOffered: slots.rows[0]?.bonus_points_offered ?? 0,
      uniquePlayers30d: uniquePlayers,
      matchesFinished30d: finishedMatches,
      activeMatches: activity.rows[0]?.active_matches ?? 0,
      rotationIndex,
      monthKey: getMonthKey(),
      leaderboard,
      autoFillGapsEnabled: Boolean(club.autoFillGapsEnabled),
    };
  }

  async setAutoFillGaps(
    clubId: string,
    userId: string,
    input: {
      enabled: boolean;
      hoursBefore?: number;
      autoCreateMatch?: boolean;
      notifyEnabled?: boolean;
    },
  ) {
    await this.assertClubRole(userId, clubId);
    assertClubId(clubId);
    const hoursBefore =
      input.hoursBefore != null
        ? Math.min(72, Math.max(1, Math.round(Number(input.hoursBefore))))
        : null;
    const result = await this.db.query(
      `UPDATE clubs
       SET auto_fill_gaps_enabled = $2,
           gap_fill_hours_before = COALESCE($3, gap_fill_hours_before),
           gap_fill_auto_create_match = COALESCE($4, gap_fill_auto_create_match),
           gap_fill_notify_enabled = COALESCE($5, gap_fill_notify_enabled),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, auto_fill_gaps_enabled, gap_fill_hours_before,
                 gap_fill_auto_create_match, gap_fill_notify_enabled`,
      [
        clubId,
        input.enabled,
        hoursBefore,
        input.autoCreateMatch ?? null,
        input.notifyEnabled ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Club no encontrado');
    }
    const row = result.rows[0];
    return {
      id: row.id,
      autoFillGapsEnabled: Boolean(row.auto_fill_gaps_enabled),
      gapFillHoursBefore: Number(row.gap_fill_hours_before ?? 8),
      gapFillAutoCreateMatch: Boolean(row.gap_fill_auto_create_match),
      gapFillNotifyEnabled: row.gap_fill_notify_enabled !== false,
    };
  }

  async getClubImpact(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);

    const monthKey = getMonthKey();
    const monthStart = `${monthKey}-01`;

    const [revenue, newPlayers, activity] = await Promise.all([
      this.db.query(
        `SELECT
           COALESCE((
             SELECT SUM(md.amount)
             FROM match_deposits md
             INNER JOIN matches m ON m.id = md.match_id
             WHERE m.club_id = $1
               AND md.status = 'APPROVED'
               AND COALESCE(md.paid_at, md.updated_at) >= $2::date
           ), 0)::float8 AS deposits,
           COALESCE((
             SELECT SUM(sp.subtotal)
             FROM shop_purchases sp
             WHERE sp.club_id = $1
               AND sp.status = 'CONFIRMED'
               AND sp.created_at >= $2::date
           ), 0)::float8 AS shop`,
        [clubId, monthStart],
      ),
      this.db.query(
        `SELECT COUNT(DISTINCT p.user_id)::int AS count
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         INNER JOIN matches m ON m.id = mp.match_id
         WHERE m.club_id = $1
           AND m.status = 'FINISHED'
           AND m.date >= $2::date
           AND mp.status IN ('JOINED', 'CONFIRMED')
           AND NOT EXISTS (
             SELECT 1
             FROM match_players mp2
             INNER JOIN matches m2 ON m2.id = mp2.match_id
             WHERE mp2.player_id = mp.player_id
               AND m2.club_id = $1
               AND m2.status = 'FINISHED'
               AND m2.date < $2::date
               AND mp2.status IN ('JOINED', 'CONFIRMED')
           )`,
        [clubId, monthStart],
      ),
      this.db.query(
        `SELECT
           COUNT(DISTINCT m.id) FILTER (
             WHERE m.status = 'FINISHED' AND m.date >= $2::date
           )::int AS matches_finished,
           COUNT(DISTINCT mp.player_id) FILTER (
             WHERE m.status = 'FINISHED'
               AND m.date >= $2::date
               AND mp.status IN ('JOINED', 'CONFIRMED')
           )::int AS active_players
         FROM matches m
         LEFT JOIN match_players mp ON mp.match_id = m.id
         WHERE m.club_id = $1`,
        [clubId, monthStart],
      ),
    ]);

    const collectedDeposits = Number(revenue.rows[0]?.deposits ?? 0);
    const collectedShop = Number(revenue.rows[0]?.shop ?? 0);

    return {
      monthKey,
      revenueCollected: collectedDeposits + collectedShop,
      revenueDeposits: collectedDeposits,
      revenueShop: collectedShop,
      newPlayers: newPlayers.rows[0]?.count ?? 0,
      matchesFinished: activity.rows[0]?.matches_finished ?? 0,
      activePlayers: activity.rows[0]?.active_players ?? 0,
    };
  }

  async getInternalRanking(
    clubId: string,
    userId: string,
    period: RankingPeriod = 'monthly',
    monthKey?: string,
    limit = 20,
  ) {
    await this.assertClubRole(userId, clubId);
    const safeLimit = Math.min(50, Math.max(5, limit));
    if (period === 'monthly') {
      return this.queryMonthlyLeaderboard(clubId, safeLimit, monthKey);
    }
    return this.queryPeriodLeaderboard(clubId, period, safeLimit);
  }

  async getRevenue(clubId: string, userId: string, periodDays = 30, movementsLimit = 15) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);

    const days = Math.min(365, Math.max(0, periodDays));
    const periodFilter = days > 0 ? `>= NOW() - ($2::int * INTERVAL '1 day')` : 'IS NOT NULL';
    const periodParams = days > 0 ? [clubId, days] : [clubId];
    const safeMovementsLimit = Math.min(1000, Math.max(1, movementsLimit));

    const [deposits, pendingDeposits, shop, pendingShop, recentDeposits, recentShop] = await Promise.all([
      this.db.query(
        `SELECT COALESCE(SUM(md.amount), 0)::float8 AS total, COUNT(*)::int AS count
         FROM match_deposits md
         INNER JOIN matches m ON m.id = md.match_id
         WHERE m.club_id = $1 AND md.status = 'APPROVED'
           AND COALESCE(md.paid_at, md.updated_at) ${periodFilter}`,
        periodParams,
      ),
      this.db.query(
        `SELECT COALESCE(SUM(md.amount), 0)::float8 AS total, COUNT(*)::int AS count
         FROM match_deposits md
         INNER JOIN matches m ON m.id = md.match_id
         WHERE m.club_id = $1 AND md.status = 'PENDING'
           AND md.created_at ${periodFilter}`,
        periodParams,
      ),
      this.db.query(
        `SELECT COALESCE(SUM(sp.subtotal), 0)::float8 AS total, COUNT(*)::int AS count
         FROM shop_purchases sp
         WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
           AND sp.created_at ${periodFilter}`,
        periodParams,
      ),
      this.db.query(
        `SELECT COALESCE(SUM(sp.subtotal), 0)::float8 AS total, COUNT(*)::int AS count
         FROM shop_purchases sp
         WHERE sp.club_id = $1 AND sp.status = 'PENDING'
           AND sp.created_at ${periodFilter}`,
        periodParams,
      ),
      this.db.query(
        `SELECT md.id,
                md.amount,
                md.status,
                md.provider,
                md.checkout_url,
                md.provider_payment_id,
                md.match_id,
                COALESCE(md.paid_at, md.updated_at) AS occurred_at,
                u.name AS user_name,
                m.title AS match_title,
                m.date AS match_date,
                m.court_slot_id,
                cas.court_label
         FROM match_deposits md
         INNER JOIN matches m ON m.id = md.match_id
         INNER JOIN users u ON u.id = md.user_id
         LEFT JOIN court_availability_slots cas ON cas.id = m.court_slot_id
         WHERE m.club_id = $1 AND md.status IN ('APPROVED', 'PENDING')
           AND COALESCE(md.paid_at, md.updated_at) ${periodFilter}
         ORDER BY occurred_at DESC
         LIMIT $${periodParams.length + 1}`,
        [...periodParams, safeMovementsLimit],
      ),
      this.db.query(
        `SELECT sp.id,
                sp.subtotal AS amount,
                sp.status,
                sp.created_at AS occurred_at,
                u.name AS user_name,
                p.name AS product_name,
                m.title AS match_title
         FROM shop_purchases sp
         INNER JOIN club_shop_products p ON p.id = sp.product_id
         INNER JOIN users u ON u.id = sp.user_id
         LEFT JOIN matches m ON m.id = sp.match_id
         WHERE sp.club_id = $1 AND sp.status <> 'CANCELLED'
           AND sp.created_at ${periodFilter}
         ORDER BY sp.created_at DESC
         LIMIT $${periodParams.length + 1}`,
        [...periodParams, safeMovementsLimit],
      ),
    ]);

    const collectedDeposits = Number(deposits.rows[0]?.total ?? 0);
    const collectedShop = Number(shop.rows[0]?.total ?? 0);
    const pendingDepositsTotal = Number(pendingDeposits.rows[0]?.total ?? 0);
    const pendingShopTotal = Number(pendingShop.rows[0]?.total ?? 0);

    const recent = [
      ...recentDeposits.rows.map((row) => ({
        id: row.id,
        kind: 'deposit' as const,
        label: row.match_title ? `Seña · ${row.match_title}` : 'Seña de cancha',
        userName: row.user_name,
        amount: Number(row.amount),
        status: row.status,
        occurredAt: row.occurred_at,
        matchId: row.match_id ?? null,
        provider: row.provider ?? null,
        checkoutUrl: row.checkout_url ?? null,
        providerPaymentId: row.provider_payment_id ?? null,
        matchDate: row.match_date ?? null,
        courtLabel: row.court_label ?? null,
      })),
      ...recentShop.rows.map((row) => ({
        id: row.id,
        kind: 'shop' as const,
        label: row.product_name,
        userName: row.user_name,
        amount: Number(row.amount),
        status: row.status,
        occurredAt: row.occurred_at,
        matchId: null as string | null,
        provider: null as string | null,
        checkoutUrl: null as string | null,
        providerPaymentId: null as string | null,
        matchDate: null as string | null,
        courtLabel: null as string | null,
      })),
    ]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, safeMovementsLimit);

    return {
      periodDays: days,
      monthKey: getMonthKey(),
      summary: {
        collectedDeposits,
        collectedShop,
        totalCollected: collectedDeposits + collectedShop,
        pendingDeposits: pendingDepositsTotal,
        pendingShop: pendingShopTotal,
        totalPending: pendingDepositsTotal + pendingShopTotal,
        depositCount: deposits.rows[0]?.count ?? 0,
        shopSaleCount: shop.rows[0]?.count ?? 0,
      },
      recent,
    };
  }

  async getPublicLeaderboard(clubId: string, limit = 20, monthKey?: string) {
    await this.findOne(clubId);
    return this.queryMonthlyLeaderboard(clubId, limit, monthKey);
  }

  async getPublicRewards(clubId: string) {
    await this.findOne(clubId);
    const result = await this.db.query(
      `SELECT id, title, description, points_required, reward_type
       FROM club_reward_catalog
       WHERE club_id = $1 AND active = TRUE
       ORDER BY points_required ASC`,
      [clubId],
    );
    return result.rows;
  }

  async getMyClubPoints(clubId: string, userId: string, monthKey?: string) {
    await this.findOne(clubId);
    const month = monthKey ?? getMonthKey();

    const [wallet, monthly] = await Promise.all([
      this.db.query(
        `SELECT COALESCE(SUM(points), 0)::int AS points,
                COALESCE(SUM(matches_at_club), 0)::int AS matches_at_club,
                MAX(last_played_at) AS last_played_at
         FROM club_member_points
         WHERE user_id = $1`,
        [userId],
      ),
      this.db.query(
        `SELECT COALESCE(SUM(points), 0)::int AS points,
                COALESCE(SUM(matches_played), 0)::int AS matches_played,
                MAX(updated_at) AS updated_at
         FROM club_member_monthly_points
         WHERE user_id = $1 AND month_key = $2`,
        [userId, month],
      ),
    ]);

    const walletRow = wallet.rows[0];
    const monthlyRow = monthly.rows[0];

    return {
      points: walletRow?.points ?? 0,
      matchesAtClub: walletRow?.matches_at_club ?? 0,
      lastPlayedAt: walletRow?.last_played_at ?? null,
      monthKey: month,
      monthlyPoints: monthlyRow?.points ?? 0,
      monthlyMatchesPlayed: monthlyRow?.matches_played ?? 0,
    };
  }

  async redeemReward(clubId: string, userId: string, rewardId: string) {
    await this.findOne(clubId);

    const rewardResult = await this.db.query(
      `SELECT id, title, points_required FROM club_reward_catalog
       WHERE id = $1 AND club_id = $2 AND active = TRUE`,
      [rewardId, clubId],
    );
    const reward = rewardResult.rows[0];
    if (!reward) {
      throw new NotFoundException('Premio no encontrado');
    }

    const balanceResult = await this.db.query(
      `SELECT COALESCE(SUM(points), 0)::int AS points
       FROM club_member_points
       WHERE user_id = $1`,
      [userId],
    );
    const balance = Number(balanceResult.rows[0]?.points ?? 0);
    if (balance < reward.points_required) {
      throw new BadRequestException(
        `Te faltan ${reward.points_required - balance} puntos para canjear este premio`,
      );
    }

    const deductionsResult = await this.db.query<{
      club_id: string;
      deducted: number;
    }>(
      `WITH balances AS (
         SELECT club_id,
                points,
                SUM(points) OVER (
                  ORDER BY
                    CASE WHEN club_id = $2 THEN 0 ELSE 1 END,
                    points DESC,
                    club_id ASC
                ) AS running_points
         FROM club_member_points
         WHERE user_id = $1 AND points > 0
       ),
       cuts AS (
         SELECT club_id,
                GREATEST(
                  0,
                  LEAST(points, $3 - (running_points - points))
                )::int AS deducted
         FROM balances
         WHERE (running_points - points) < $3
       ),
       updated AS (
         UPDATE club_member_points cmp
         SET points = cmp.points - cuts.deducted,
             updated_at = NOW()
         FROM cuts
         WHERE cmp.user_id = $1
           AND cmp.club_id = cuts.club_id
           AND cuts.deducted > 0
         RETURNING cmp.club_id, cuts.deducted
       )
       SELECT club_id, deducted
       FROM updated`,
      [userId, clubId, reward.points_required],
    );
    const deductedTotal = deductionsResult.rows.reduce(
      (sum, row) => sum + Number(row.deducted ?? 0),
      0,
    );
    if (deductedTotal < Number(reward.points_required)) {
      throw new BadRequestException('No se pudo descontar el saldo global de puntos');
    }

    for (const row of deductionsResult.rows) {
      await this.db.query(
        `INSERT INTO club_points_ledger (club_id, user_id, amount, reason, reference_id)
         VALUES ($1, $2, $3, 'REWARD_REDEEM', $4)`,
        [row.club_id, userId, -Number(row.deducted), rewardId],
      );
    }

    await this.db.query(
      `INSERT INTO club_reward_redemptions (club_id, user_id, reward_id, points_spent)
       VALUES ($1, $2, $3, $4)`,
      [clubId, userId, rewardId, reward.points_required],
    );

    await this.db.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'REWARD_REDEEMED', $2, $3, $4::jsonb)`,
      [
        userId,
        'Premio canjeado',
        `Canjeaste "${reward.title}" en el club. Presentate en recepción para retirarlo.`,
        JSON.stringify({ clubId, rewardId }),
      ],
    );

    return {
      ok: true,
      rewardTitle: reward.title,
      pointsSpent: reward.points_required,
      remainingPoints: balance - reward.points_required,
    };
  }

  private async queryPeriodLeaderboard(clubId: string, period: RankingPeriod, limit = 20) {
    if (period === 'weekly') {
      const result = await this.db.query(
        `SELECT cpl.user_id,
                u.name,
                p.nickname,
                p.photo_url,
                SUM(cpl.amount)::int AS points,
                COUNT(*) FILTER (WHERE cpl.amount > 0)::int AS matches_at_club,
                RANK() OVER (ORDER BY SUM(cpl.amount) DESC) AS rank
         FROM club_points_ledger cpl
         INNER JOIN users u ON u.id = cpl.user_id
         LEFT JOIN players p ON p.user_id = cpl.user_id
         WHERE cpl.club_id = $1
           AND cpl.created_at >= NOW() - INTERVAL '7 days'
           AND cpl.amount > 0
         GROUP BY cpl.user_id, u.name, p.nickname, p.photo_url
         HAVING SUM(cpl.amount) > 0
         ORDER BY points DESC, matches_at_club DESC
         LIMIT $2`,
        [clubId, limit],
      );
      return result.rows;
    }

    const year = new Date().getFullYear().toString();
    const result = await this.db.query(
      `SELECT cmmp.user_id,
              u.name,
              p.nickname,
              p.photo_url,
              SUM(cmmp.points)::int AS points,
              SUM(cmmp.matches_played)::int AS matches_at_club,
              RANK() OVER (ORDER BY SUM(cmmp.points) DESC) AS rank
       FROM club_member_monthly_points cmmp
       INNER JOIN users u ON u.id = cmmp.user_id
       LEFT JOIN players p ON p.user_id = cmmp.user_id
       WHERE cmmp.club_id = $1 AND cmmp.month_key LIKE $2 AND cmmp.points > 0
       GROUP BY cmmp.user_id, u.name, p.nickname, p.photo_url
       ORDER BY points DESC, matches_at_club DESC
       LIMIT $3`,
      [clubId, `${year}-%`, limit],
    );
    return result.rows;
  }

  private async queryMonthlyLeaderboard(clubId: string, limit = 20, monthKey?: string) {
    const month = monthKey ?? getMonthKey();
    const result = await this.db.query(
      `SELECT cmmp.user_id,
              u.name,
              p.nickname,
              p.photo_url,
              cmmp.points,
              cmmp.matches_played AS matches_at_club,
              cmmp.updated_at AS last_played_at,
              cmmp.month_key,
              RANK() OVER (ORDER BY cmmp.points DESC, cmmp.matches_played DESC) AS rank
       FROM club_member_monthly_points cmmp
       INNER JOIN users u ON u.id = cmmp.user_id
       LEFT JOIN players p ON p.user_id = cmmp.user_id
       WHERE cmmp.club_id = $1 AND cmmp.month_key = $2 AND cmmp.points > 0
       ORDER BY cmmp.points DESC, cmmp.matches_played DESC
       LIMIT $3`,
      [clubId, month, limit],
    );
    return result.rows;
  }

  async listPromotions(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `SELECT id, club_id, label, day_of_week, start_hour, end_hour, bonus_points, active, created_at
       FROM club_promotions
       WHERE club_id = $1
       ORDER BY start_hour ASC`,
      [clubId],
    );
    return result.rows;
  }

  async createPromotion(clubId: string, userId: string, dto: CreateClubPromotionDto) {
    await this.assertClubRole(userId, clubId);
    if (dto.startHour >= dto.endHour) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio');
    }

    const result = await this.db.query(
      `INSERT INTO club_promotions (club_id, label, day_of_week, start_hour, end_hour, bonus_points, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        clubId,
        dto.label,
        dto.dayOfWeek ?? null,
        dto.startHour,
        dto.endHour,
        dto.bonusPoints ?? 0,
        dto.active ?? true,
      ],
    );
    return result.rows[0];
  }

  async deletePromotion(clubId: string, userId: string, promotionId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE club_promotions SET active = FALSE WHERE id = $1 AND club_id = $2 RETURNING id`,
      [promotionId, clubId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Promoción no encontrada');
    }
    return { ok: true };
  }

  async listRewards(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `SELECT id, club_id, title, description, points_required, reward_type, active, created_at
       FROM club_reward_catalog
       WHERE club_id = $1 AND active = TRUE
       ORDER BY points_required ASC`,
      [clubId],
    );
    return result.rows;
  }

  async createReward(clubId: string, userId: string, dto: CreateClubRewardDto) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `INSERT INTO club_reward_catalog (club_id, title, description, points_required, reward_type, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        clubId,
        dto.title,
        dto.description ?? null,
        dto.pointsRequired,
        dto.rewardType ?? 'BENEFIT',
        dto.active ?? true,
      ],
    );
    return result.rows[0];
  }

  async updateReward(clubId: string, userId: string, rewardId: string, dto: UpdateClubRewardDto) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE club_reward_catalog
       SET title = COALESCE($3, title),
           description = COALESCE($4, description),
           points_required = COALESCE($5, points_required),
           reward_type = COALESCE($6, reward_type),
           active = COALESCE($7, active)
       WHERE id = $1 AND club_id = $2
       RETURNING id, club_id, title, description, points_required, reward_type, active, created_at`,
      [
        rewardId,
        clubId,
        dto.title ?? null,
        dto.description ?? null,
        dto.pointsRequired ?? null,
        dto.rewardType ?? null,
        dto.active ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Premio no encontrado');
    }
    return result.rows[0];
  }

  async listRewardRedemptions(clubId: string, userId: string, limit = 50) {
    await this.assertClubRole(userId, clubId);
    const safeLimit = Math.min(100, Math.max(5, limit));
    const result = await this.db.query(
      `SELECT r.id,
              r.points_spent,
              r.created_at,
              u.name AS user_name,
              p.nickname AS user_nickname,
              rc.title AS reward_title
       FROM club_reward_redemptions r
       INNER JOIN users u ON u.id = r.user_id
       LEFT JOIN players p ON p.user_id = r.user_id
       INNER JOIN club_reward_catalog rc ON rc.id = r.reward_id
       WHERE r.club_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [clubId, safeLimit],
    );
    return result.rows;
  }

  async listShopProducts(clubId: string, options: { matchExtraOnly?: boolean } = {}) {
    await this.findOne(clubId);
    const params: Array<string | boolean> = [clubId];
    let extraFilter = '';
    if (options.matchExtraOnly) {
      extraFilter = 'AND available_as_match_extra = TRUE';
    }
    const result = await this.db.query(
      `SELECT id, name, description, price, kind, category, stock_quantity, available_as_match_extra, photo_url
       FROM club_shop_products
       WHERE club_id = $1 AND active = TRUE ${extraFilter}
       ORDER BY name ASC`,
      params,
    );
    return result.rows;
  }

  async listShopProductsManage(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);
    const result = await this.db.query(
      `SELECT id, name, description, price, kind, category, stock_quantity, available_as_match_extra, photo_url, active, created_at
       FROM club_shop_products
       WHERE club_id = $1
       ORDER BY active DESC, name ASC`,
      [clubId],
    );
    return result.rows;
  }

  async createShopProduct(clubId: string, userId: string, dto: CreateShopProductDto) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);
    const kind = dto.kind ?? 'GENERAL';
    const matchExtra =
      dto.availableAsMatchExtra ?? (kind === 'MATCH_ADDON');
    const result = await this.db.query(
      `INSERT INTO club_shop_products
         (club_id, name, description, price, kind, category, stock_quantity, available_as_match_extra, active)
       VALUES ($1, $2, $3, $4, 'GENERAL', $5, $6, $7, TRUE)
       RETURNING id, name, description, price, kind, category, stock_quantity, available_as_match_extra, photo_url, active, created_at`,
      [
        clubId,
        dto.name.trim(),
        dto.description?.trim() || null,
        dto.price,
        dto.category ?? 'OTHER',
        dto.stockQuantity ?? null,
        matchExtra,
      ],
    );
    return result.rows[0];
  }

  async updateShopProduct(
    clubId: string,
    userId: string,
    productId: string,
    dto: UpdateShopProductDto,
  ) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }

    const result = await this.db.query(
      `UPDATE club_shop_products
       SET name = COALESCE($3, name),
           description = CASE WHEN $4::text IS NOT NULL THEN NULLIF(TRIM($4), '') ELSE description END,
           price = COALESCE($5, price),
           kind = COALESCE($6, kind),
           category = COALESCE($7, category),
           stock_quantity = COALESCE($8, stock_quantity),
           active = COALESCE($9, active),
           available_as_match_extra = COALESCE($10, available_as_match_extra),
           updated_at = NOW()
       WHERE id = $1 AND club_id = $2
       RETURNING id, name, description, price, kind, category, stock_quantity, available_as_match_extra, photo_url, active, created_at`,
      [
        productId,
        clubId,
        dto.name?.trim() ?? null,
        dto.description !== undefined ? dto.description : null,
        dto.price ?? null,
        dto.kind ?? null,
        dto.category ?? null,
        dto.stockQuantity ?? null,
        dto.active ?? null,
        dto.availableAsMatchExtra ?? null,
      ],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Producto no encontrado');
    }
    return result.rows[0];
  }

  async uploadShopProductPhoto(
    clubId: string,
    userId: string,
    productId: string,
    file: Express.Multer.File,
  ) {
    await this.assertClubRole(userId, clubId);
    assertClubId(clubId);

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }

    const current = await this.db.query(
      `SELECT id, photo_url FROM club_shop_products WHERE id = $1 AND club_id = $2`,
      [productId, clubId],
    );
    const product = current.rows[0];
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const previousPhotoUrl = product.photo_url as string | undefined;
    const upload = await uploadImageBuffer(file, `playtomic-clone/clubs/${clubId}/shop`);

    const result = await this.db.query(
      `UPDATE club_shop_products
       SET photo_url = $3, updated_at = NOW()
       WHERE id = $1 AND club_id = $2
       RETURNING id, name, description, price, kind, category, stock_quantity,
                 available_as_match_extra, photo_url, active, created_at`,
      [productId, clubId, upload.secure_url],
    );

    if (previousPhotoUrl && previousPhotoUrl !== upload.secure_url) {
      await deleteCloudinaryAsset(previousPhotoUrl);
    }

    return result.rows[0];
  }

  async confirmShopPurchase(clubId: string, userId: string, purchaseId: string) {
    await this.assertClubRole(userId, clubId);
    assertClubId(clubId);

    const existing = await this.db.query<{ id: string; status: string; club_id: string }>(
      `SELECT id, status, club_id FROM shop_purchases WHERE id = $1`,
      [purchaseId],
    );
    const purchase = existing.rows[0];
    if (!purchase || purchase.club_id !== clubId) {
      throw new NotFoundException('Compra no encontrada en este club');
    }
    if (purchase.status === 'CONFIRMED') {
      return { ok: true, status: 'CONFIRMED' as const };
    }
    if (purchase.status !== 'PENDING') {
      throw new BadRequestException(
        `La compra no se puede confirmar (estado actual: ${purchase.status})`,
      );
    }

    const updated = await this.db.query(
      `UPDATE shop_purchases
       SET status = 'CONFIRMED', updated_at = NOW()
       WHERE id = $1 AND club_id = $2 AND status = 'PENDING'
       RETURNING id, status, club_id, quantity, subtotal, created_at, updated_at`,
      [purchaseId, clubId],
    );
    if (!updated.rows[0]) {
      throw new BadRequestException('No se pudo confirmar la compra');
    }
    return { ok: true, status: 'CONFIRMED' as const, purchase: updated.rows[0] };
  }

  async markDepositPaid(clubId: string, userId: string, depositId: string) {
    await this.assertClubRole(userId, clubId);
    assertClubId(clubId);

    const row = await this.db.query<{
      id: string;
      status: string;
      club_id: string | null;
    }>(
      `SELECT md.id, md.status, m.club_id
       FROM match_deposits md
       INNER JOIN matches m ON m.id = md.match_id
       WHERE md.id = $1`,
      [depositId],
    );
    const deposit = row.rows[0];
    if (!deposit || deposit.club_id !== clubId) {
      throw new NotFoundException('Seña no encontrada en este club');
    }
    if (deposit.status === 'APPROVED') {
      return { ok: true, alreadyPaid: true };
    }
    if (deposit.status !== 'PENDING') {
      throw new BadRequestException(
        `La seña no se puede marcar como pagada (estado actual: ${deposit.status})`,
      );
    }

    const approved = await this.paymentsService.approveDeposit(depositId, 'manual-reception');
    if (!approved) {
      throw new BadRequestException('No se pudo aprobar la seña');
    }

    await this.db.query(
      `UPDATE match_deposits
       SET provider = 'MANUAL'::payment_provider, updated_at = NOW()
       WHERE id = $1`,
      [depositId],
    );

    const refreshed = await this.db.query(`SELECT * FROM match_deposits WHERE id = $1`, [
      depositId,
    ]);
    return { ok: true, alreadyPaid: false, deposit: refreshed.rows[0] };
  }

  async updateShopProductStock(
    clubId: string,
    userId: string,
    productId: string,
    dto: UpdateShopStockDto,
  ) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE club_shop_products
       SET stock_quantity = $3
       WHERE id = $1 AND club_id = $2
       RETURNING id, name, stock_quantity, active, photo_url`,
      [productId, clubId, dto.stockQuantity],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Producto no encontrado');
    }
    return result.rows[0];
  }

  async deactivateShopProduct(clubId: string, userId: string, productId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE club_shop_products SET active = FALSE WHERE id = $1 AND club_id = $2 RETURNING id`,
      [productId, clubId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Producto no encontrado');
    }
    return { ok: true };
  }

  async listShopSales(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `SELECT sp.id,
              sp.quantity,
              sp.subtotal,
              sp.status,
              sp.created_at,
              p.name AS product_name,
              u.name AS user_name,
              m.title AS match_title
       FROM shop_purchases sp
       INNER JOIN club_shop_products p ON p.id = sp.product_id
       INNER JOIN users u ON u.id = sp.user_id
       LEFT JOIN matches m ON m.id = sp.match_id
       WHERE sp.club_id = $1
       ORDER BY sp.created_at DESC
       LIMIT 50`,
      [clubId],
    );
    return result.rows;
  }

  async getShopStats(clubId: string, userId: string, periodDays = 30) {
    await this.assertClubRole(userId, clubId);
    await this.findOne(clubId);
    const days = Math.min(90, Math.max(7, periodDays));

    const [result, topProduct, lastSale, lowStock, extrasSold] = await Promise.all([
      this.db.query<{
        category: string;
        revenue: number;
        sales_count: number;
      }>(
        `SELECT p.category,
                COALESCE(SUM(sp.subtotal), 0)::float8 AS revenue,
                COUNT(*)::int AS sales_count
         FROM shop_purchases sp
         INNER JOIN club_shop_products p ON p.id = sp.product_id
         WHERE sp.club_id = $1
           AND sp.status = 'CONFIRMED'
           AND sp.created_at >= NOW() - ($2::int * INTERVAL '1 day')
         GROUP BY p.category
         ORDER BY revenue DESC`,
        [clubId, days],
      ),
      this.db.query<{
        product_id: string;
        name: string;
        revenue: number;
        sales_count: number;
      }>(
        `SELECT p.id AS product_id, p.name,
                COALESCE(SUM(sp.subtotal), 0)::float8 AS revenue,
                COUNT(*)::int AS sales_count
         FROM shop_purchases sp
         INNER JOIN club_shop_products p ON p.id = sp.product_id
         WHERE sp.club_id = $1
           AND sp.status = 'CONFIRMED'
           AND sp.created_at >= NOW() - ($2::int * INTERVAL '1 day')
         GROUP BY p.id, p.name
         ORDER BY sales_count DESC, revenue DESC
         LIMIT 1`,
        [clubId, days],
      ),
      this.db.query<{
        product_name: string;
        subtotal: number;
        created_at: string;
        quantity: number;
      }>(
        `SELECT p.name AS product_name, sp.subtotal::float8 AS subtotal,
                sp.created_at::text AS created_at, sp.quantity
         FROM shop_purchases sp
         INNER JOIN club_shop_products p ON p.id = sp.product_id
         WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
         ORDER BY sp.created_at DESC
         LIMIT 1`,
        [clubId],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM club_shop_products
         WHERE club_id = $1 AND active = TRUE
           AND stock_quantity IS NOT NULL AND stock_quantity <= 3`,
        [clubId],
      ),
      this.db.query<{ revenue: number; sales_count: number }>(
        `SELECT COALESCE(SUM(sp.subtotal), 0)::float8 AS revenue,
                COUNT(*)::int AS sales_count
         FROM shop_purchases sp
         INNER JOIN club_shop_products p ON p.id = sp.product_id
         WHERE sp.club_id = $1
           AND sp.status = 'CONFIRMED'
           AND p.available_as_match_extra = TRUE
           AND sp.created_at >= NOW() - ($2::int * INTERVAL '1 day')`,
        [clubId, days],
      ),
    ]);

    const byCategory = result.rows.map((row) => ({
      category: row.category,
      revenue: Number(row.revenue ?? 0),
      salesCount: row.sales_count ?? 0,
    }));

    const top = topProduct.rows[0];
    const last = lastSale.rows[0];

    return {
      periodDays: days,
      totalRevenue: byCategory.reduce((sum, row) => sum + row.revenue, 0),
      totalSales: byCategory.reduce((sum, row) => sum + row.salesCount, 0),
      byCategory,
      topProduct: top
        ? {
            id: top.product_id,
            name: top.name,
            revenue: Number(top.revenue ?? 0),
            salesCount: top.sales_count ?? 0,
          }
        : null,
      lastSale: last
        ? {
            productName: last.product_name,
            subtotal: Number(last.subtotal ?? 0),
            quantity: last.quantity,
            createdAt: last.created_at,
          }
        : null,
      lowStockCount: lowStock.rows[0]?.count ?? 0,
      extrasSold: {
        revenue: Number(extrasSold.rows[0]?.revenue ?? 0),
        salesCount: extrasSold.rows[0]?.sales_count ?? 0,
      },
    };
  }

  async listShopCoupons(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `SELECT id, code, label, discount_percent, discount_amount, points_cost,
              max_uses, uses_count, active, expires_at, created_at
       FROM club_shop_coupons
       WHERE club_id = $1
       ORDER BY active DESC, created_at DESC`,
      [clubId],
    );
    return result.rows;
  }

  async createShopCoupon(clubId: string, userId: string, dto: CreateShopCouponDto) {
    await this.assertClubRole(userId, clubId);
    const code = dto.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Indicá un código de cupón');
    }
    const result = await this.db.query(
      `INSERT INTO club_shop_coupons
         (club_id, code, label, discount_percent, discount_amount, points_cost, max_uses, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING *`,
      [
        clubId,
        code,
        dto.label.trim(),
        dto.discountPercent ?? null,
        dto.discountAmount ?? null,
        dto.pointsCost ?? null,
        dto.maxUses ?? null,
      ],
    );
    return result.rows[0];
  }

  async deactivateShopCoupon(clubId: string, userId: string, couponId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE club_shop_coupons SET active = FALSE WHERE id = $1 AND club_id = $2 RETURNING id`,
      [couponId, clubId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Cupón no encontrado');
    }
    return { ok: true };
  }

  private async resolveSlotBonus(
    clubId: string,
    dto: Pick<CreateCourtSlotDto, 'slotDate' | 'startHour' | 'endHour'>,
  ): Promise<number> {
    const slotDate = String(dto.slotDate).slice(0, 10);
    const dayOfWeek = new Date(`${slotDate}T12:00:00`).getDay();
    if (Number.isNaN(dayOfWeek)) {
      return 0;
    }

    const result = await this.db.query<{ bonus_points: number }>(
      `SELECT bonus_points
       FROM club_promotions
       WHERE club_id = $1
         AND active = TRUE
         AND (day_of_week IS NULL OR day_of_week = $2)
         AND start_hour < $4
         AND end_hour > $3
       ORDER BY bonus_points DESC
       LIMIT 1`,
      [clubId, dayOfWeek, dto.startHour, dto.endHour],
    );
    return Number(result.rows[0]?.bonus_points ?? 0);
  }

  private resolveSlotPricePerHour(
    club: { courtPricePerHour?: number; court_price_per_hour?: number },
    explicitPricePerHour?: number,
  ): number | null {
    if (explicitPricePerHour != null && Number.isFinite(explicitPricePerHour)) {
      return Math.max(0, Math.round(Number(explicitPricePerHour) * 100) / 100);
    }
    const hourly = Number(club.courtPricePerHour ?? club.court_price_per_hour ?? 0);
    if (hourly > 0) {
      return Math.round(hourly * 100) / 100;
    }
    return null;
  }

  private async getCourtOrThrow(clubId: string, courtId: string) {
    assertClubId(clubId);
    if (!courtId || !UUID_RE.test(courtId)) {
      throw new BadRequestException('ID de cancha inválido');
    }
    const result = await this.db.query(
      `SELECT id, club_id, name, active, has_fixed_schedule, sort_order, created_at, updated_at
       FROM courts WHERE id = $1 AND club_id = $2`,
      [courtId, clubId],
    );
    const court = result.rows[0];
    if (!court) {
      throw new NotFoundException('Cancha no encontrada');
    }
    return court as {
      id: string;
      club_id: string;
      name: string;
      active: boolean;
      has_fixed_schedule: boolean;
      sort_order: number;
      created_at: string;
      updated_at: string;
    };
  }

  /** Resuelve cancha por id o label; crea la fila si solo viene el label. */
  private async resolveCourtForSlot(
    clubId: string,
    courtId?: string | null,
    courtLabel?: string | null,
  ) {
    if (courtId) {
      return this.getCourtOrThrow(clubId, courtId);
    }

    const name = (courtLabel || 'Cancha 1').trim();
    if (!name) {
      throw new BadRequestException('Indicá el nombre o número de cancha');
    }

    const existing = await this.db.query(
      `SELECT id, club_id, name, active, has_fixed_schedule, sort_order, created_at, updated_at
       FROM courts WHERE club_id = $1 AND name = $2`,
      [clubId, name],
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const created = await this.db.query(
      `INSERT INTO courts (club_id, name, active, has_fixed_schedule, sort_order)
       VALUES ($1, $2, TRUE, FALSE, 0)
       ON CONFLICT (club_id, name) DO UPDATE SET updated_at = NOW()
       RETURNING id, club_id, name, active, has_fixed_schedule, sort_order, created_at, updated_at`,
      [clubId, name],
    );
    return created.rows[0];
  }

  private formatHourLabel(hour: number): string {
    const totalMinutes = Math.round(Number(hour) * 60);
    if (totalMinutes >= 24 * 60) return '00:00';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  async requireClubAdmin(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    return this.findOne(clubId);
  }

  private async assertClubRole(userId: string, clubId?: string) {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = result.rows[0]?.role;
    if (!isClubRole(role)) {
      throw new ForbiddenException('Solo cuentas de club pueden gestionar clubes y horarios');
    }
    if (clubId) {
      await this.assertClubAdminOf(clubId, userId);
    }
  }
}
