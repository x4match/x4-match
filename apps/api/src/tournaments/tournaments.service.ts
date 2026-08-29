import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateTournamentPhotoDto } from './dto/create-tournament-photo.dto';
import {
  CreateRegistrationDto,
  CreateTournamentDateDto,
  CreateTournamentDto,
  CreateTournamentInvitesDto,
  CreateTournamentMatchDto,
  GenerateFixtureDto,
  SetScoreDto,
  UpdateMatchDto,
  UpdateTournamentDto,
} from './dto/tournament-dtos';
import { v2 as cloudinary } from 'cloudinary';

const EVENT_CREATOR_ROLES = ['PLAYER', 'ORGANIZER', 'CLUB_ADMIN', 'SUPER_ADMIN'];

type TournamentViewer = {
  userId?: string | null;
  inviteToken?: string | null;
};

@Injectable()
export class TournamentsService {
  constructor(private readonly db: DatabaseService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  // ---------------------------------------------------------------------------
  // Torneos
  // ---------------------------------------------------------------------------

  async create(userId: string, dto: CreateTournamentDto) {
    await this.assertCanCreateEvents(userId);
    const modality = dto.modality;
    const price = dto.price ?? null;

    let clubId: string | null = null;
    let status: string;
    let clubValidationStatus: string;
    let inviteToken: string | null = null;

    if (modality === 'EXTERNAL') {
      if (!dto.clubId) {
        throw new BadRequestException('Un torneo externo requiere un club registrado');
      }
      const club = await this.db.query(`SELECT id FROM clubs WHERE id = $1`, [dto.clubId]);
      if (!club.rows[0]) {
        throw new BadRequestException('El club indicado no está registrado');
      }
      clubId = dto.clubId;
      status = 'DRAFT';
      clubValidationStatus = 'PENDING';
    } else {
      inviteToken = randomBytes(24).toString('hex');
      status = dto.status ?? 'OPEN_REGISTRATION';
      clubValidationStatus = 'NOT_REQUIRED';
    }

    const result = await this.db.query(
      `INSERT INTO tournaments
        (club_id, name, description, category, format, gender, start_date, max_teams,
         courts_available, price, payment_required, rules, prizes, status, organizer_user_id,
         modality, invite_token, club_validation_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::tournament_status,$15,
               $16::tournament_modality,$17,$18::tournament_club_validation_status)
       RETURNING *`,
      [
        clubId,
        dto.name,
        dto.description ?? null,
        dto.category ?? null,
        dto.format ?? 'GROUPS_THEN_ELIMINATION',
        dto.gender ?? null,
        dto.startDate ?? null,
        dto.maxTeams ?? 16,
        dto.courtsAvailable ?? 2,
        price,
        price != null && Number(price) > 0,
        dto.rules ?? null,
        dto.prizes ?? null,
        status,
        userId,
        modality,
        inviteToken,
        clubValidationStatus,
      ],
    );
    return result.rows[0];
  }

  async list() {
    const result = await this.db.query(
      `SELECT t.*,
              c.name AS club_name,
              (SELECT COUNT(*)::int FROM tournament_registrations r
                 WHERE r.tournament_id = t.id AND r.status = 'APPROVED') AS approved_count,
              (SELECT COUNT(*)::int FROM tournament_registrations r
                 WHERE r.tournament_id = t.id AND r.status = 'PENDING') AS pending_count
       FROM tournaments t
       LEFT JOIN clubs c ON c.id = t.club_id
       WHERE t.modality = 'EXTERNAL'
         AND t.club_validation_status = 'APPROVED'
         AND t.status IN ('OPEN_REGISTRATION', 'IN_PROGRESS', 'FINISHED')
       ORDER BY
         CASE t.status WHEN 'OPEN_REGISTRATION' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END,
         t.start_date NULLS LAST,
         t.created_at DESC
       LIMIT 100`,
    );
    return result.rows;
  }

  /** Torneos del organizador autenticado (microcosmos / historial). */
  async listMine(userId: string, status?: string) {
    // Cualquier usuario autenticado puede listar los torneos que creó.

    const params: unknown[] = [userId];
    let statusFilter = '';
    if (status && status !== 'ALL') {
      params.push(status);
      statusFilter = ` AND t.status = $${params.length}::tournament_status`;
    }

    const result = await this.db.query(
      `SELECT t.*,
              c.name AS club_name,
              (SELECT COUNT(*)::int FROM tournament_registrations r
                 WHERE r.tournament_id = t.id AND r.status = 'APPROVED') AS approved_count,
              (SELECT COUNT(*)::int FROM tournament_registrations r
                 WHERE r.tournament_id = t.id AND r.status = 'PENDING') AS pending_count,
              (SELECT COUNT(*)::int FROM tournament_registrations r
                 WHERE r.tournament_id = t.id) AS total_count,
              (SELECT COUNT(*)::int FROM tournament_matches m
                 WHERE m.tournament_id = t.id) AS matches_count,
              (SELECT COUNT(*)::int FROM tournament_matches m
                 WHERE m.tournament_id = t.id AND m.status = 'FINISHED') AS matches_finished_count
       FROM tournaments t
       LEFT JOIN clubs c ON c.id = t.club_id
       WHERE t.organizer_user_id = $1
       ${statusFilter}
       ORDER BY
         CASE t.status
           WHEN 'IN_PROGRESS' THEN 0
           WHEN 'OPEN_REGISTRATION' THEN 1
           WHEN 'DRAFT' THEN 2
           WHEN 'FINISHED' THEN 3
           ELSE 4
         END,
         t.start_date DESC NULLS LAST,
         t.created_at DESC
       LIMIT 200`,
      params,
    );
    return result.rows;
  }

  async getById(id: string, viewer?: TournamentViewer) {
    const tournament = await this.loadTournamentRow(id);
    await this.assertCanViewTournament(tournament, viewer ?? {});
    return this.buildTournamentDetail(tournament);
  }

  /** Detalle sin chequeo de acceso (uso interno tras assertCanManage / etc.). */
  async getByIdUnchecked(id: string) {
    const tournament = await this.loadTournamentRow(id);
    return this.buildTournamentDetail(tournament);
  }

  async update(id: string, userId: string, dto: UpdateTournamentDto) {
    await this.assertCanManageTournament(id, userId);

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const set = (col: string, val: unknown) => {
      fields.push(`${col} = $${i++}`);
      values.push(val);
    };

    if (dto.name !== undefined) set('name', dto.name);
    if (dto.description !== undefined) set('description', dto.description);
    if (dto.category !== undefined) set('category', dto.category);
    if (dto.format !== undefined) set('format', dto.format);
    if (dto.gender !== undefined) set('gender', dto.gender);
    if (dto.clubId !== undefined) set('club_id', dto.clubId);
    if (dto.startDate !== undefined) set('start_date', dto.startDate);
    if (dto.maxTeams !== undefined) set('max_teams', dto.maxTeams);
    if (dto.courtsAvailable !== undefined) set('courts_available', dto.courtsAvailable);
    if (dto.price !== undefined) {
      set('price', dto.price);
      set('payment_required', dto.price != null && Number(dto.price) > 0);
    }
    if (dto.rules !== undefined) set('rules', dto.rules);
    if (dto.prizes !== undefined) set('prizes', dto.prizes);

    if (fields.length === 0 && dto.status === undefined) {
      return this.getByIdUnchecked(id);
    }

    if (dto.status !== undefined) {
      fields.push(`status = $${i++}::tournament_status`);
      values.push(dto.status);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await this.db.query(
      `UPDATE tournaments SET ${fields.join(', ')} WHERE id = $${i}`,
      values,
    );
    return this.getByIdUnchecked(id);
  }

  async remove(id: string, userId: string) {
    await this.assertCanManageTournament(id, userId);
    await this.db.query(`DELETE FROM tournaments WHERE id = $1`, [id]);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Fechas
  // ---------------------------------------------------------------------------

  async listDates(tournamentId: string) {
    const result = await this.db.query(
      `SELECT id, tournament_id, play_date, label, notes, created_at
       FROM tournament_dates WHERE tournament_id = $1 ORDER BY play_date ASC`,
      [tournamentId],
    );
    return result.rows;
  }

  async addDate(tournamentId: string, userId: string, dto: CreateTournamentDateDto) {
    await this.assertCanManageTournament(tournamentId, userId);
    const result = await this.db.query(
      `INSERT INTO tournament_dates (tournament_id, play_date, label, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tournamentId, dto.playDate, dto.label ?? null, dto.notes ?? null],
    );
    return result.rows[0];
  }

  async removeDate(tournamentId: string, dateId: string, userId: string) {
    await this.assertCanManageTournament(tournamentId, userId);
    const result = await this.db.query(
      `DELETE FROM tournament_dates WHERE id = $1 AND tournament_id = $2 RETURNING id`,
      [dateId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Fecha no encontrada');
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Inscripciones
  // ---------------------------------------------------------------------------

  async listRegistrations(
    tournamentId: string,
    viewerUserId?: string,
    inviteToken?: string | null,
  ) {
    const tournament = await this.loadTournamentRow(tournamentId);
    await this.assertCanViewTournament(tournament, {
      userId: viewerUserId,
      inviteToken,
    });
    const result = await this.db.query(
      `SELECT r.*,
              u1.name AS player1_account_name, p1.photo_url AS player1_photo,
              u2.name AS player2_account_name, p2.photo_url AS player2_photo
       FROM tournament_registrations r
       LEFT JOIN users u1 ON u1.id = r.player1_user_id
       LEFT JOIN players p1 ON p1.user_id = r.player1_user_id
       LEFT JOIN users u2 ON u2.id = r.player2_user_id
       LEFT JOIN players p2 ON p2.user_id = r.player2_user_id
       WHERE r.tournament_id = $1
       ORDER BY
         CASE r.status WHEN 'APPROVED' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
         r.created_at ASC`,
      [tournamentId],
    );

    const organizerRow = await this.db.query(
      `SELECT organizer_user_id FROM tournaments WHERE id = $1`,
      [tournamentId],
    );
    const canSeePayments =
      !!viewerUserId && organizerRow.rows[0]?.organizer_user_id === viewerUserId;

    if (canSeePayments) {
      return result.rows;
    }

    // Solo el organizador ve estado/monto de pago de las inscripciones.
    return result.rows.map((row) => {
      const {
        payment_status: _paymentStatus,
        payment_amount: _paymentAmount,
        payment_paid_at: _paymentPaidAt,
        payment_provider: _paymentProvider,
        payment_checkout_url: _paymentCheckoutUrl,
        payment_external_reference: _paymentExternalRef,
        payment_currency: _paymentCurrency,
        ...publicRow
      } = row;
      return {
        ...publicRow,
        payment_required: row.payment_required,
        payment_status: null,
        payment_amount: null,
        payment_paid_at: null,
        payment_checkout_url: null,
      };
    });
  }

  async getMyRegistration(tournamentId: string, userId: string) {
    const result = await this.db.query(
      `SELECT * FROM tournament_registrations
       WHERE tournament_id = $1
         AND (created_by_user_id = $2 OR player1_user_id = $2 OR player2_user_id = $2)
       ORDER BY created_at DESC LIMIT 1`,
      [tournamentId, userId],
    );
    return result.rows[0] ?? null;
  }

  async register(
    tournamentId: string,
    userId: string | null,
    dto: CreateRegistrationDto,
    inviteToken?: string | null,
  ) {
    const tournament = await this.getByIdUnchecked(tournamentId);
    const managerRegistration =
      dto.onBehalf && userId ? await this.canManageTournament(tournamentId, userId) : false;
    if (!managerRegistration) {
      await this.assertCanViewTournament(tournament, { userId, inviteToken });
      if (tournament.modality === 'INTERNAL') {
        await this.assertInternalParticipant(tournament, userId, inviteToken);
      }
      if (tournament.status !== 'OPEN_REGISTRATION') {
        throw new BadRequestException('Las inscripciones no están abiertas');
      }
      if (
        tournament.modality === 'EXTERNAL' &&
        tournament.club_validation_status !== 'APPROVED'
      ) {
        throw new BadRequestException('El torneo aún no fue validado por el club');
      }
      if (tournament.spots_left != null && tournament.spots_left <= 0) {
        throw new BadRequestException('No quedan cupos disponibles');
      }
    }

    const price = tournament.price != null ? Number(tournament.price) : 0;
    const paymentRequired = price > 0;
    const tournamentCategory = tournament.category ? String(tournament.category) : null;
    const isSumCategory = tournamentCategory != null && /^Suma\s+\d+$/i.test(tournamentCategory.trim());
    // En categoría fija la pareja hereda la del torneo; en suma se guarda el detalle enviado.
    const registrationCategory = isSumCategory
      ? dto.category ?? tournamentCategory
      : tournamentCategory;

    const result = await this.db.query(
      `INSERT INTO tournament_registrations
        (tournament_id, created_by_user_id, player1_user_id, player2_user_id,
         player1_name, player2_name, player1_email, player2_email, phone, category,
         status, payment_required, payment_status, payment_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING',$11,$12,$13)
       RETURNING *`,
      [
        tournamentId,
        userId,
        dto.player1UserId ?? (dto.onBehalf ? null : userId),
        dto.player2UserId ?? null,
        dto.player1Name,
        dto.player2Name,
        dto.player1Email ?? null,
        dto.player2Email ?? null,
        dto.phone ?? null,
        registrationCategory,
        paymentRequired,
        paymentRequired ? 'PENDING' : null,
        paymentRequired ? price : null,
      ],
    );
    return result.rows[0];
  }

  async approveRegistration(tournamentId: string, regId: string, userId: string) {
    await this.assertCanManageTournament(tournamentId, userId);
    const result = await this.db.query(
      `UPDATE tournament_registrations
       SET status = 'APPROVED', approved_at = NOW(), rejected_at = NULL
       WHERE id = $1 AND tournament_id = $2 RETURNING *`,
      [regId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Inscripción no encontrada');
    return result.rows[0];
  }

  async rejectRegistration(tournamentId: string, regId: string, userId: string) {
    await this.assertCanManageTournament(tournamentId, userId);
    const result = await this.db.query(
      `UPDATE tournament_registrations
       SET status = 'REJECTED', rejected_at = NOW()
       WHERE id = $1 AND tournament_id = $2 RETURNING *`,
      [regId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Inscripción no encontrada');
    return result.rows[0];
  }

  async removeRegistration(tournamentId: string, regId: string, userId: string) {
    const reg = await this.getRegistrationOrThrow(tournamentId, regId);
    const isOwner =
      reg.created_by_user_id === userId ||
      reg.player1_user_id === userId ||
      reg.player2_user_id === userId;
    const canManage = await this.canManageTournament(tournamentId, userId);
    if (!isOwner && !canManage) {
      throw new ForbiddenException('No podés eliminar esta inscripción');
    }
    await this.db.query(`DELETE FROM tournament_registrations WHERE id = $1`, [regId]);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Pagos de inscripción (opcional)
  // ---------------------------------------------------------------------------

  private isMockMode(): boolean {
    return (
      process.env.PAYMENTS_MOCK === 'true' || !process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    );
  }

  private publicApiBase(): string {
    return (process.env.API_PUBLIC_URL || process.env.APP_URL || 'http://localhost:5000').replace(
      /\/$/,
      '',
    );
  }

  async createRegistrationCheckout(tournamentId: string, regId: string, userId: string) {
    const reg = await this.getRegistrationOrThrow(tournamentId, regId);
    const isOwner =
      reg.created_by_user_id === userId ||
      reg.player1_user_id === userId ||
      reg.player2_user_id === userId;
    if (!isOwner) {
      throw new ForbiddenException('Solo podés pagar tu propia inscripción');
    }
    if (!reg.payment_required || !reg.payment_amount || Number(reg.payment_amount) <= 0) {
      return { required: false, paid: true, amount: 0, message: 'Este torneo no requiere pago' };
    }
    if (reg.payment_status === 'APPROVED') {
      return {
        required: true,
        paid: true,
        amount: Number(reg.payment_amount),
        checkoutUrl: reg.payment_checkout_url,
      };
    }

    const amount = Number(reg.payment_amount);
    const currency = reg.payment_currency || 'ARS';
    const externalReference = `treg:${reg.id}`;

    if (this.isMockMode()) {
      const mockUrl = `${this.publicApiBase()}/tournaments/pay/mock?ref=${encodeURIComponent(externalReference)}`;
      await this.db.query(
        `UPDATE tournament_registrations
         SET payment_status = 'PENDING', payment_provider = 'MOCK',
             payment_external_reference = $2, payment_checkout_url = $3
         WHERE id = $1`,
        [reg.id, externalReference, mockUrl],
      );
      return {
        required: true,
        paid: false,
        amount,
        currency,
        provider: 'MOCK',
        checkoutUrl: mockUrl,
        mock: true,
      };
    }

    const tournament = await this.getByIdUnchecked(tournamentId);
    const checkout = await this.createMercadoPagoPreference(
      externalReference,
      `Inscripción ${tournament.name}`,
      amount,
      currency,
    );
    await this.db.query(
      `UPDATE tournament_registrations
       SET payment_status = 'PENDING', payment_provider = 'MERCADOPAGO',
           payment_external_reference = $2, payment_checkout_url = $3
       WHERE id = $1`,
      [reg.id, externalReference, checkout.initPoint],
    );
    return {
      required: true,
      paid: false,
      amount,
      currency,
      provider: 'MERCADOPAGO',
      checkoutUrl: checkout.initPoint,
      preferenceId: checkout.preferenceId,
    };
  }

  async simulatePayment(tournamentId: string, regId: string, userId: string) {
    if (!this.isMockMode()) {
      throw new BadRequestException('Simulación solo disponible en modo mock');
    }
    const reg = await this.getRegistrationOrThrow(tournamentId, regId);
    const isOwner =
      reg.created_by_user_id === userId ||
      reg.player1_user_id === userId ||
      reg.player2_user_id === userId;
    if (!isOwner) throw new ForbiddenException('No podés pagar otra inscripción');
    await this.approvePaymentByRef(`treg:${reg.id}`);
    return { ok: true };
  }

  /** Organizador marca el pago como acreditado (efectivo, transferencia, prueba, etc.). */
  async markRegistrationPaid(tournamentId: string, regId: string, userId: string) {
    const tournament = await this.db.query(
      `SELECT organizer_user_id FROM tournaments WHERE id = $1`,
      [tournamentId],
    );
    if (!tournament.rows[0]) throw new NotFoundException('Torneo no encontrado');
    const role = await this.getRole(userId);
    if (tournament.rows[0].organizer_user_id !== userId && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo el organizador de este torneo puede marcar pagos');
    }
    const reg = await this.getRegistrationOrThrow(tournamentId, regId);
    if (!reg.payment_required) {
      throw new BadRequestException('Esta inscripción no requiere pago');
    }
    if (reg.payment_status === 'APPROVED') {
      return reg;
    }
    const result = await this.db.query(
      `UPDATE tournament_registrations
       SET payment_status = 'APPROVED',
           payment_paid_at = NOW(),
           payment_provider = COALESCE(payment_provider, 'MANUAL')
       WHERE id = $1 AND tournament_id = $2
       RETURNING *`,
      [regId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Inscripción no encontrada');
    return result.rows[0];
  }

  async approvePaymentByRef(externalReference: string) {
    const regId = externalReference.replace('treg:', '');
    const result = await this.db.query(
      `UPDATE tournament_registrations
       SET payment_status = 'APPROVED', payment_paid_at = NOW()
       WHERE id = $1 RETURNING *`,
      [regId],
    );
    return result.rows[0] ?? null;
  }

  async handleMercadoPagoWebhook(body: { type?: string; data?: { id?: string } }) {
    if (body?.type !== 'payment' || !body?.data?.id) return { ok: true, ignored: true };
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!accessToken) return { ok: false, error: 'not_configured' };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MercadoPagoConfig, Payment } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken });
    const payment = await new Payment(client).get({ id: body.data.id });
    if (payment.status === 'approved' && payment.external_reference) {
      await this.approvePaymentByRef(String(payment.external_reference));
    }
    return { ok: true };
  }

  private async createMercadoPagoPreference(
    externalReference: string,
    title: string,
    amount: number,
    currency: string,
  ) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN!.trim();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MercadoPagoConfig, Preference } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);
    const base = this.publicApiBase();
    const result = await preference.create({
      body: {
        items: [
          {
            id: externalReference,
            title: title.slice(0, 120),
            quantity: 1,
            unit_price: amount,
            currency_id: currency,
          },
        ],
        external_reference: externalReference,
        notification_url: `${base}/tournaments/webhooks/mercadopago`,
        back_urls: { success: `${base}/tournaments/pay/return` },
        auto_return: 'approved',
      },
    });
    const initPoint = result.init_point || result.sandbox_init_point;
    if (!initPoint) throw new BadRequestException('Mercado Pago no devolvió URL de pago');
    return { initPoint, preferenceId: String(result.id) };
  }

  // ---------------------------------------------------------------------------
  // Partidos / Fixture
  // ---------------------------------------------------------------------------

  async listMatches(tournamentId: string, viewer?: TournamentViewer) {
    const tournament = await this.loadTournamentRow(tournamentId);
    await this.assertCanViewTournament(tournament, viewer ?? {});
    return this.listMatchesUnchecked(tournamentId);
  }

  private async listMatchesUnchecked(tournamentId: string) {
    const result = await this.db.query(
      `SELECT * FROM tournament_matches WHERE tournament_id = $1
       ORDER BY round ASC, created_at ASC`,
      [tournamentId],
    );
    return result.rows;
  }

  async createMatch(tournamentId: string, userId: string, dto: CreateTournamentMatchDto) {
    await this.loadTournamentRow(tournamentId);
    await this.assertCanManageTournament(tournamentId, userId);

    const teamAName = dto.teamAName ?? (await this.registrationName(dto.teamARegistrationId));
    const teamBName = dto.teamBName ?? (await this.registrationName(dto.teamBRegistrationId));

    const result = await this.db.query(
      `INSERT INTO tournament_matches
        (tournament_id, date_id, round, round_label, group_name, court_label,
         team_a_registration_id, team_b_registration_id, team_a_name, team_b_name, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        tournamentId,
        dto.dateId ?? null,
        dto.round ?? 1,
        dto.roundLabel ?? null,
        dto.groupName ?? null,
        dto.courtLabel ?? null,
        dto.teamARegistrationId ?? null,
        dto.teamBRegistrationId ?? null,
        teamAName,
        teamBName,
        dto.scheduledAt ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateMatch(tournamentId: string, matchId: string, userId: string, dto: UpdateMatchDto) {
    await this.assertCanManageTournament(tournamentId, userId);
    const match = await this.getMatchOrThrow(tournamentId, matchId);

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (dto.courtLabel !== undefined) {
      fields.push(`court_label = $${i++}`);
      values.push(dto.courtLabel);
    }
    if (dto.scheduledAt !== undefined) {
      fields.push(`scheduled_at = $${i++}`);
      values.push(dto.scheduledAt);
    }
    if (dto.dateId !== undefined) {
      fields.push(`date_id = $${i++}`);
      values.push(dto.dateId);
    }
    if (dto.status !== undefined) {
      fields.push(`status = $${i++}::tournament_match_status`);
      values.push(dto.status);
      if (dto.status === 'IN_PROGRESS') fields.push(`started_at = NOW()`);
    }
    if (!fields.length) return match;
    fields.push(`updated_at = NOW()`);
    values.push(matchId);
    const result = await this.db.query(
      `UPDATE tournament_matches SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return result.rows[0];
  }

  async setMatchScore(tournamentId: string, matchId: string, userId: string, dto: SetScoreDto) {
    await this.assertCanManageTournament(tournamentId, userId);
    const match = await this.getMatchOrThrow(tournamentId, matchId);
    if (!dto.sets?.length) throw new BadRequestException('Sets requeridos');

    let setsA = 0;
    let setsB = 0;
    for (const set of dto.sets) {
      if (set.teamA > set.teamB) setsA++;
      else if (set.teamB > set.teamA) setsB++;
    }
    const winnerId =
      setsA === setsB ? null : setsA > setsB ? match.team_a_registration_id : match.team_b_registration_id;

    const result = await this.db.query(
      `UPDATE tournament_matches
       SET score = $2, status = 'FINISHED', finished_at = NOW(),
           winner_registration_id = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [matchId, JSON.stringify({ sets: dto.sets, setsA, setsB }), winnerId],
    );
    return result.rows[0];
  }

  async removeMatch(tournamentId: string, matchId: string, userId: string) {
    await this.assertCanManageTournament(tournamentId, userId);
    await this.getMatchOrThrow(tournamentId, matchId);
    await this.db.query(`DELETE FROM tournament_matches WHERE id = $1`, [matchId]);
    return { success: true };
  }

  async generateFixture(tournamentId: string, userId: string, dto: GenerateFixtureDto) {
    const tournament = await this.getByIdUnchecked(tournamentId);
    await this.assertCanManageTournament(tournamentId, userId);

    const approved = await this.db.query(
      `SELECT id, player1_name, player2_name FROM tournament_registrations
       WHERE tournament_id = $1 AND status = 'APPROVED' ORDER BY created_at ASC`,
      [tournamentId],
    );
    const teams = approved.rows;
    if (teams.length < 2) {
      throw new BadRequestException('Se necesitan al menos 2 parejas aprobadas');
    }

    if (dto.reset) {
      await this.db.query(`DELETE FROM tournament_matches WHERE tournament_id = $1`, [tournamentId]);
    }

    const label = (t: any) => `${t.player1_name} / ${t.player2_name}`;
    const mode = dto.mode || 'ROUND_ROBIN';
    const matches: {
      a: any;
      b: any;
      round: number;
      roundLabel: string;
      courtLabel?: string | null;
    }[] = [];

    if (mode === 'ROUND_ROBIN') {
      let round = 1;
      for (let a = 0; a < teams.length; a++) {
        for (let b = a + 1; b < teams.length; b++) {
          matches.push({ a: teams[a], b: teams[b], round, roundLabel: `Fecha ${round}` });
          round++;
        }
      }
    } else if (mode === 'OPEN_COURT') {
      // Todos contra todos empaquetados en turnos según canchas disponibles
      const courts = Math.max(1, Number(tournament.courts_available) || 2);
      const n = teams.length;
      const withBye = n % 2 === 1 ? [...teams, null] : [...teams];
      const total = withBye.length;
      const half = total / 2;
      const roundCount = total - 1;
      let arr = [...withBye];
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
          const needsSub =
            pairs.length > courts ? `.${Math.floor(offset / courts) + 1}` : '';
          batch.forEach((p, courtIdx) => {
            matches.push({
              a: p.a,
              b: p.b,
              round: globalRound,
              roundLabel: `Turno ${r + 1}${needsSub}`,
              courtLabel: `Cancha ${courtIdx + 1}`,
            });
          });
          globalRound++;
        }

        const fixed = arr[0];
        const rest = arr.slice(1);
        const last = rest.pop();
        if (last !== undefined) rest.unshift(last);
        arr = [fixed, ...rest];
      }
    } else {
      // Eliminación directa (primera ronda)
      const shuffled = [...teams];
      for (let i = 0; i < shuffled.length; i += 2) {
        const a = shuffled[i];
        const b = shuffled[i + 1];
        if (b) matches.push({ a, b, round: 1, roundLabel: 'Primera ronda' });
      }
    }

    for (const m of matches) {
      await this.db.query(
        `INSERT INTO tournament_matches
          (tournament_id, round, round_label, court_label, team_a_registration_id, team_b_registration_id, team_a_name, team_b_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          tournamentId,
          m.round,
          m.roundLabel,
          m.courtLabel ?? null,
          m.a.id,
          m.b.id,
          label(m.a),
          label(m.b),
        ],
      );
    }

    await this.db.query(
      `UPDATE tournaments SET status = 'IN_PROGRESS', updated_at = NOW()
       WHERE id = $1 AND status = 'OPEN_REGISTRATION'`,
      [tournamentId],
    );

    return this.listMatchesUnchecked(tournamentId);
  }

  async getStandings(tournamentId: string, viewer?: TournamentViewer) {
    const tournament = await this.loadTournamentRow(tournamentId);
    await this.assertCanViewTournament(tournament, viewer ?? {});
    const [regs, matches] = await Promise.all([
      this.db.query(
        `SELECT id, player1_name, player2_name FROM tournament_registrations
         WHERE tournament_id = $1 AND status = 'APPROVED'`,
        [tournamentId],
      ),
      this.db.query(
        `SELECT * FROM tournament_matches WHERE tournament_id = $1 AND status = 'FINISHED'`,
        [tournamentId],
      ),
    ]);

    const table = new Map<string, any>();
    for (const r of regs.rows) {
      table.set(r.id, {
        registrationId: r.id,
        teamName: `${r.player1_name} / ${r.player2_name}`,
        played: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0,
      });
    }

    for (const m of matches.rows) {
      const a = table.get(m.team_a_registration_id);
      const b = table.get(m.team_b_registration_id);
      if (!a || !b) continue;
      const score = m.score || {};
      a.played++;
      b.played++;
      a.setsWon += score.setsA ?? 0;
      a.setsLost += score.setsB ?? 0;
      b.setsWon += score.setsB ?? 0;
      b.setsLost += score.setsA ?? 0;
      if (m.winner_registration_id === a.registrationId) {
        a.wins++;
        a.points += 3;
        b.losses++;
      } else if (m.winner_registration_id === b.registrationId) {
        b.wins++;
        b.points += 3;
        a.losses++;
      }
    }

    return [...table.values()]
      .sort((x, y) => y.points - x.points || y.setsWon - y.setsLost - (x.setsWon - x.setsLost))
      .map((row, idx) => ({ ...row, position: idx + 1 }));
  }

  // ---------------------------------------------------------------------------
  // Fotos (existente)
  // ---------------------------------------------------------------------------

  async addPhoto(tournamentId: string, userId: string, dto: CreateTournamentPhotoDto) {
    await this.loadTournamentRow(tournamentId);
    await this.assertCanManageTournament(tournamentId, userId);
    this.validatePhotoPayload(dto.photoUrl);
    const upload = await this.uploadTournamentImage(tournamentId, dto.photoUrl);
    const result = await this.db.query(
      `INSERT INTO tournament_photos (tournament_id, uploaded_by_user_id, photo_url, cloudinary_public_id, caption)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tournament_id, uploaded_by_user_id, photo_url, cloudinary_public_id, caption, created_at`,
      [tournamentId, userId, upload.secure_url, upload.public_id, dto.caption ?? null],
    );
    return result.rows[0];
  }

  async listPhotos(tournamentId: string) {
    await this.loadTournamentRow(tournamentId);
    const result = await this.db.query(
      `SELECT tp.id, tp.photo_url, tp.caption, tp.created_at, u.id AS uploaded_by_user_id, u.name AS uploaded_by_name
       FROM tournament_photos tp
       INNER JOIN users u ON u.id = tp.uploaded_by_user_id
       WHERE tp.tournament_id = $1
       ORDER BY tp.created_at DESC`,
      [tournamentId],
    );
    return result.rows;
  }

  async deletePhoto(tournamentId: string, photoId: string, userId: string) {
    await this.loadTournamentRow(tournamentId);
    await this.assertCanManageTournament(tournamentId, userId);
    const photoResult = await this.db.query(
      `SELECT id, cloudinary_public_id FROM tournament_photos WHERE id = $1 AND tournament_id = $2`,
      [photoId, tournamentId],
    );
    const photo = photoResult.rows[0];
    if (!photo) throw new NotFoundException('Foto no encontrada');
    if (photo.cloudinary_public_id) {
      await cloudinary.uploader.destroy(photo.cloudinary_public_id, { resource_type: 'image' });
    }
    await this.db.query(`DELETE FROM tournament_photos WHERE id = $1`, [photoId]);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async loadTournamentRow(id: string) {
    const result = await this.db.query(
      `SELECT t.*, c.name AS club_name
       FROM tournaments t
       LEFT JOIN clubs c ON c.id = t.club_id
       WHERE t.id = $1`,
      [id],
    );
    const tournament = result.rows[0];
    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }
    return tournament;
  }

  private async buildTournamentDetail(tournament: any) {
    const id = tournament.id as string;
    const [photos, dates, regCounts] = await Promise.all([
      this.db.query(
        `SELECT tp.id, tp.photo_url, tp.caption, tp.created_at, u.id AS uploaded_by_user_id, u.name AS uploaded_by_name
         FROM tournament_photos tp
         INNER JOIN users u ON u.id = tp.uploaded_by_user_id
         WHERE tp.tournament_id = $1
         ORDER BY tp.created_at DESC`,
        [id],
      ),
      this.db.query(
        `SELECT id, tournament_id, play_date, label, notes, created_at
         FROM tournament_dates WHERE tournament_id = $1 ORDER BY play_date ASC`,
        [id],
      ),
      this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_count,
           COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
           COUNT(*)::int AS total_count
         FROM tournament_registrations WHERE tournament_id = $1`,
        [id],
      ),
    ]);

    return {
      ...tournament,
      photos: photos.rows,
      dates: dates.rows,
      approved_count: regCounts.rows[0]?.approved_count ?? 0,
      pending_count: regCounts.rows[0]?.pending_count ?? 0,
      total_count: regCounts.rows[0]?.total_count ?? 0,
      spots_left:
        tournament.max_teams != null
          ? Math.max(0, Number(tournament.max_teams) - Number(regCounts.rows[0]?.total_count ?? 0))
          : null,
    };
  }

  private async isClubAdminOf(clubId: string, userId: string): Promise<boolean> {
    const role = await this.getRole(userId);
    if (role === 'SUPER_ADMIN') return true;
    const result = await this.db.query(
      `SELECT 1 FROM club_admins WHERE club_id = $1 AND user_id = $2 LIMIT 1`,
      [clubId, userId],
    );
    return Boolean(result.rows[0]);
  }

  private async assertClubAdminOf(clubId: string, userId: string) {
    if (!(await this.isClubAdminOf(clubId, userId))) {
      throw new ForbiddenException('Solo admins de este club pueden realizar esta acción');
    }
  }

  private async isInvitedUser(tournamentId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM tournament_invites
       WHERE tournament_id = $1 AND invited_user_id = $2 AND status <> 'REVOKED'
       LIMIT 1`,
      [tournamentId, userId],
    );
    return Boolean(result.rows[0]);
  }

  private async assertCanViewTournament(tournament: any, viewer: TournamentViewer) {
    const modality = tournament.modality || 'INTERNAL';
    const validation = tournament.club_validation_status || 'NOT_REQUIRED';

    if (modality === 'EXTERNAL' && validation === 'APPROVED') {
      return;
    }

    const userId = viewer.userId ?? null;
    if (userId && tournament.organizer_user_id === userId) {
      return;
    }

    if (userId) {
      const role = await this.getRole(userId);
      if (role === 'SUPER_ADMIN') return;
    }

    if (modality === 'EXTERNAL' && tournament.club_id && userId) {
      if (await this.isClubAdminOf(tournament.club_id, userId)) {
        return;
      }
    }

    if (modality === 'INTERNAL') {
      if (viewer.inviteToken && tournament.invite_token === viewer.inviteToken) {
        return;
      }
      if (userId && (await this.isInvitedUser(tournament.id, userId))) {
        return;
      }
    }

    throw new ForbiddenException('No tenés acceso a este torneo');
  }

  private async assertInternalParticipant(
    tournament: any,
    userId: string | null | undefined,
    inviteToken?: string | null,
  ) {
    if (userId && tournament.organizer_user_id === userId) return;
    if (inviteToken && tournament.invite_token === inviteToken) return;
    if (userId && (await this.isInvitedUser(tournament.id, userId))) return;
    throw new ForbiddenException('Necesitás una invitación para este torneo interno');
  }

  // ---------------------------------------------------------------------------
  // Invitaciones (INTERNAL)
  // ---------------------------------------------------------------------------

  async listInvites(tournamentId: string, userId: string) {
    await this.assertCanManageTournament(tournamentId, userId);
    const result = await this.db.query(
      `SELECT i.*,
              u.name AS invited_user_name,
              p.photo_url AS invited_user_photo,
              p.nickname AS invited_user_nickname
       FROM tournament_invites i
       LEFT JOIN users u ON u.id = i.invited_user_id
       LEFT JOIN players p ON p.user_id = i.invited_user_id
       WHERE i.tournament_id = $1 AND i.status <> 'REVOKED'
       ORDER BY i.created_at DESC`,
      [tournamentId],
    );
    return result.rows;
  }

  async createInvites(tournamentId: string, userId: string, dto: CreateTournamentInvitesDto) {
    await this.assertCanManageTournament(tournamentId, userId);
    const tournament = await this.loadTournamentRow(tournamentId);
    if (tournament.modality !== 'INTERNAL') {
      throw new BadRequestException('Solo los torneos internos admiten invitaciones');
    }
    const userIds = [...new Set((dto.userIds || []).filter(Boolean))];
    if (!userIds.length) {
      throw new BadRequestException('Indicá al menos un jugador');
    }

    const created: any[] = [];
    for (const invitedUserId of userIds) {
      if (invitedUserId === userId) continue;
      const existing = await this.db.query(
        `SELECT id FROM tournament_invites
         WHERE tournament_id = $1 AND invited_user_id = $2`,
        [tournamentId, invitedUserId],
      );
      if (existing.rows[0]) {
        const result = await this.db.query(
          `UPDATE tournament_invites
           SET status = 'PENDING', invited_by_user_id = $2
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id, userId],
        );
        if (result.rows[0]) created.push(result.rows[0]);
      } else {
        const result = await this.db.query(
          `INSERT INTO tournament_invites (tournament_id, invited_user_id, invited_by_user_id, status)
           VALUES ($1, $2, $3, 'PENDING')
           RETURNING *`,
          [tournamentId, invitedUserId, userId],
        );
        if (result.rows[0]) created.push(result.rows[0]);
      }
    }
    return created;
  }

  async revokeInvite(tournamentId: string, inviteId: string, userId: string) {
    await this.assertCanManageTournament(tournamentId, userId);
    const result = await this.db.query(
      `UPDATE tournament_invites
       SET status = 'REVOKED'
       WHERE id = $1 AND tournament_id = $2
       RETURNING id`,
      [inviteId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Invitación no encontrada');
    return { success: true };
  }

  async joinByInviteToken(token: string, userId: string) {
    const result = await this.db.query(
      `SELECT * FROM tournaments WHERE invite_token = $1 AND modality = 'INTERNAL'`,
      [token],
    );
    const tournament = result.rows[0];
    if (!tournament) {
      throw new NotFoundException('Link de invitación inválido');
    }

    if (tournament.organizer_user_id !== userId) {
      const existing = await this.db.query(
        `SELECT id FROM tournament_invites
         WHERE tournament_id = $1 AND invited_user_id = $2`,
        [tournament.id, userId],
      );
      if (existing.rows[0]) {
        await this.db.query(
          `UPDATE tournament_invites
           SET status = 'ACCEPTED',
               accepted_at = COALESCE(accepted_at, NOW())
           WHERE id = $1`,
          [existing.rows[0].id],
        );
      } else {
        await this.db.query(
          `INSERT INTO tournament_invites
            (tournament_id, invited_user_id, invited_by_user_id, status, accepted_at)
           VALUES ($1, $2, $3, 'ACCEPTED', NOW())`,
          [tournament.id, userId, tournament.organizer_user_id],
        );
      }
    }

    return this.buildTournamentDetail(tournament);
  }

  // ---------------------------------------------------------------------------
  // Validación de club (EXTERNAL)
  // ---------------------------------------------------------------------------

  async listPendingClubValidations(clubId: string, userId: string) {
    await this.assertClubAdminOf(clubId, userId);
    const result = await this.db.query(
      `SELECT t.*,
              c.name AS club_name,
              u.name AS organizer_name,
              (SELECT COUNT(*)::int FROM tournament_registrations r
                 WHERE r.tournament_id = t.id) AS total_count
       FROM tournaments t
       LEFT JOIN clubs c ON c.id = t.club_id
       LEFT JOIN users u ON u.id = t.organizer_user_id
       WHERE t.club_id = $1
         AND t.modality = 'EXTERNAL'
         AND t.club_validation_status = 'PENDING'
       ORDER BY t.created_at DESC`,
      [clubId],
    );
    return result.rows;
  }

  async approveClubValidation(tournamentId: string, userId: string) {
    const tournament = await this.loadTournamentRow(tournamentId);
    if (tournament.modality !== 'EXTERNAL') {
      throw new BadRequestException('Solo torneos externos requieren validación del club');
    }
    if (!tournament.club_id) {
      throw new BadRequestException('El torneo no tiene club asignado');
    }
    await this.assertClubAdminOf(tournament.club_id, userId);
    if (tournament.club_validation_status === 'APPROVED') {
      return this.buildTournamentDetail(tournament);
    }
    if (tournament.club_validation_status === 'REJECTED') {
      throw new BadRequestException('Este torneo ya fue rechazado');
    }

    const result = await this.db.query(
      `UPDATE tournaments
       SET club_validation_status = 'APPROVED',
           club_validated_at = NOW(),
           club_validated_by_user_id = $2,
           status = 'OPEN_REGISTRATION',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [tournamentId, userId],
    );
    const updated = { ...result.rows[0], club_name: tournament.club_name };
    return this.buildTournamentDetail(updated);
  }

  async rejectClubValidation(tournamentId: string, userId: string) {
    const tournament = await this.loadTournamentRow(tournamentId);
    if (tournament.modality !== 'EXTERNAL') {
      throw new BadRequestException('Solo torneos externos requieren validación del club');
    }
    if (!tournament.club_id) {
      throw new BadRequestException('El torneo no tiene club asignado');
    }
    await this.assertClubAdminOf(tournament.club_id, userId);

    const result = await this.db.query(
      `UPDATE tournaments
       SET club_validation_status = 'REJECTED',
           club_validated_at = NOW(),
           club_validated_by_user_id = $2,
           status = 'CANCELLED',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [tournamentId, userId],
    );
    const updated = { ...result.rows[0], club_name: tournament.club_name };
    return this.buildTournamentDetail(updated);
  }

  private async getRole(userId: string): Promise<string> {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = result.rows[0]?.role;
    if (!role) throw new ForbiddenException('Usuario inválido');
    return role;
  }

  private async assertCanCreateEvents(userId: string) {
    const role = await this.getRole(userId);
    if (!EVENT_CREATOR_ROLES.includes(role)) {
      throw new ForbiddenException('No tenés permiso para crear torneos');
    }
  }

  private async canManageTournament(tournamentId: string, userId: string): Promise<boolean> {
    const role = await this.getRole(userId);
    if (role === 'SUPER_ADMIN') return true;
    const result = await this.db.query(
      `SELECT organizer_user_id, club_id FROM tournaments WHERE id = $1`,
      [tournamentId],
    );
    const tournament = result.rows[0];
    if (!tournament) return false;
    if (tournament.organizer_user_id === userId) return true;
    if (tournament.club_id && (await this.isClubAdminOf(tournament.club_id, userId))) {
      return true;
    }
    return false;
  }

  private async assertCanManageTournament(tournamentId: string, userId: string) {
    const ok = await this.canManageTournament(tournamentId, userId);
    if (!ok) {
      throw new ForbiddenException('Solo el organizador de este torneo puede realizar esta acción');
    }
  }

  private async getRegistrationOrThrow(tournamentId: string, regId: string) {
    const result = await this.db.query(
      `SELECT * FROM tournament_registrations WHERE id = $1 AND tournament_id = $2`,
      [regId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Inscripción no encontrada');
    return result.rows[0];
  }

  private async getMatchOrThrow(tournamentId: string, matchId: string) {
    const result = await this.db.query(
      `SELECT * FROM tournament_matches WHERE id = $1 AND tournament_id = $2`,
      [matchId, tournamentId],
    );
    if (!result.rows[0]) throw new NotFoundException('Partido no encontrado');
    return result.rows[0];
  }

  private async registrationName(regId?: string): Promise<string | null> {
    if (!regId) return null;
    const result = await this.db.query(
      `SELECT player1_name, player2_name FROM tournament_registrations WHERE id = $1`,
      [regId],
    );
    const r = result.rows[0];
    return r ? `${r.player1_name} / ${r.player2_name}` : null;
  }

  private validatePhotoPayload(photoUrl: string) {
    if (!photoUrl.startsWith('data:image/')) {
      throw new ForbiddenException('Formato de imagen inválido');
    }
    const approxSizeBytes = Math.ceil((photoUrl.length * 3) / 4);
    const maxSizeBytes = 6 * 1024 * 1024;
    if (approxSizeBytes > maxSizeBytes) {
      throw new ForbiddenException('La imagen excede el límite de 6MB');
    }
  }

  private async uploadTournamentImage(tournamentId: string, photoDataUrl: string) {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new ForbiddenException('Cloudinary no está configurado en el servidor');
    }
    return cloudinary.uploader.upload(photoDataUrl, {
      folder: `playtomic-clone/tournaments/${tournamentId}`,
      resource_type: 'image',
      transformation: [{ width: 1600, crop: 'limit' }, { quality: 'auto' }],
    });
  }
}
