import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ClubPointsService } from '../clubs/club-points.service';
import { ClubGapFillService } from '../clubs/club-gap-fill.service';
import { CompetitiveScoringService } from '../competitive-scoring/competitive-scoring.service';
import { BadgesService } from '../badges/badges.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { isClubRole } from '../common/roles';
import { defaultLevelBand, getCategoryLevelRange, getFemaleMixedLevelRange } from '../common/utils/level-range.util';
import { resolveVisibleLevelCategory, resolvePlayerRating, PLACEMENT_ELO_K_FACTOR, PLACEMENT_MATCHES_REQUIRED, resolveMatchGenderFromPartner, normalizeBinaryGender, type MatchGender } from '../common/utils';
import { CreateMatchDto, type CourtBookingMode } from './dto/create-match.dto';
import { ListOpenMatchesQueryDto } from './dto/list-open-matches.query.dto';
import { MatchInviteDto } from './dto/match-invite.dto';
import { AddMatchInvitesDto } from './dto/add-match-invites.dto';
import { CreateMatchResultDto } from './dto/create-match-result.dto';
import { ConfirmMatchResultDto } from './dto/confirm-match-result.dto';
import { RejectMatchResultDto } from './dto/reject-match-result.dto';
import { PlayerRatingDto } from './dto/player-rating.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';
import { MatchesRepository } from './matches.repository';
import { PaymentsService } from '../payments/payments.service';
import { parseBestOfThreeSets } from '../common/utils/match-result.util';
import { computeMatchRatingChanges, splitParticipantsByTeam } from '../rating/engine';

const DEFAULT_SEARCH_RADIUS_KM = 30;
const MAX_SEARCH_RADIUS_KM = 100;

@Injectable()
export class MatchesService {
  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly clubPointsService: ClubPointsService,
    private readonly clubGapFillService: ClubGapFillService,
    private readonly competitiveScoringService: CompetitiveScoringService,
    private readonly badgesService: BadgesService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  private static readonly LEAVABLE_STATUSES = ['OPEN', 'FULL', 'CONFIRMED'] as const;
  private static readonly ACTIVE_PLAYER_STATUSES = ['JOINED', 'CONFIRMED', 'REQUESTED'] as const;

  private resolveCourtBooking(dto: CreateMatchDto): CourtBookingMode {
    if (dto.courtBooking) return dto.courtBooking;
    if (dto.courtSlotId) return 'in_app';
    if (dto.venueNote?.trim()) return 'external';
    return 'none';
  }

  private validateCourtBooking(dto: CreateMatchDto, booking: CourtBookingMode) {
    if (booking === 'in_app') {
      if (!dto.clubId || !dto.courtSlotId) {
        throw new BadRequestException('La reserva en la app requiere club y turno de cancha');
      }
      return;
    }

    if (dto.courtSlotId) {
      throw new BadRequestException('El turno de cancha solo aplica a reserva en la app');
    }

    if (booking === 'external') {
      const hasVenue = Boolean(dto.venueNote?.trim() || dto.zone?.trim());
      if (!hasVenue) {
        throw new BadRequestException('Indicá dónde reservaste la cancha (nota o zona)');
      }
    }
  }

  async resolveGenderForInvites(
    userId: string,
    invites: MatchInviteDto[] | undefined,
    requested: MatchGender = 'open',
    _mode?: string,
  ): Promise<MatchGender> {
    const partnerInvite = invites?.find((invite) => invite.role === 'partner' && invite.userId);
    if (!partnerInvite?.userId) return requested;

    const [selfGender, partnerGender] = await Promise.all([
      this.matchesRepository.getGenderByUserId(userId),
      this.matchesRepository.getGenderByUserId(partnerInvite.userId),
    ]);
    return resolveMatchGenderFromPartner(selfGender, partnerGender, requested);
  }

  async expirePastCourtWindowMatches(): Promise<number> {
    await this.matchesRepository.expirePastCourtSlots();
    return this.matchesRepository.expirePastCourtWindowMatches();
  }

  private async refreshExpiredCourtWindows() {
    await this.expirePastCourtWindowMatches();
  }

  async create(userId: string, dto: CreateMatchDto) {
    dto.gender = await this.resolveGenderForInvites(
      userId,
      dto.invites,
      dto.gender ?? 'open',
      dto.mode,
    );

    if (dto.levelMin == null || dto.levelMax == null) {
      const placement = await this.matchesRepository.getPlayerPlacementBandByUserId(userId);
      const creatorGender = await this.matchesRepository.getGenderByUserId(userId);
      const isFemaleMixed =
        dto.gender === 'mixed' && normalizeBinaryGender(creatorGender) === 'female';

      if (placement?.categoryStatus === 'provisional' && placement.declaredCategory) {
        const band = isFemaleMixed
          ? getFemaleMixedLevelRange(placement.declaredCategory)
          : getCategoryLevelRange(placement.declaredCategory);
        dto.levelMin = dto.levelMin ?? band.min;
        dto.levelMax = dto.levelMax ?? band.max;
      } else {
        const level = placement?.skillScore ?? (await this.matchesRepository.getPlayerSkillScoreByUserId(userId));
        const band = defaultLevelBand(level ?? 400);
        dto.levelMin = dto.levelMin ?? band.min;
        dto.levelMax = dto.levelMax ?? band.max;
      }
    }

    const courtBooking = this.resolveCourtBooking(dto);
    this.validateCourtBooking(dto, courtBooking);
    dto.courtBooking = courtBooking;
    if (courtBooking !== 'external') {
      dto.venueNote = undefined;
    }

    if (dto.courtSlotId && !dto.clubId) {
      throw new BadRequestException('El turno de cancha requiere un club');
    }

    const result = await this.matchesRepository.create(userId, dto);
    const match = result.rows[0];

    if (dto.courtSlotId && dto.clubId) {
      await this.matchesRepository.bookCourtSlot(dto.courtSlotId, dto.clubId);
    }

    const playerId = await this.matchesRepository.getPlayerIdByUserId(userId);
    if (playerId) {
      await this.matchesRepository.join(match.id, playerId, 'JOINED', 1);
    }

    await this.joinInvitedPlayers(match.id, userId, dto.invites);
    await this.syncMatchCapacityStatus(match.id);

    await this.matchesRepository.createMatchChatIfMissing(match.id);
    const detail = await this.matchesRepository.getDetail(match.id);
    this.realtimeGateway.emitMatchUpdated(detail);
    return detail;
  }

  async listOpenMatches(viewerUserId: string, query: ListOpenMatchesQueryDto) {
    await this.refreshExpiredCourtWindows();

    const category = await this.resolveViewerCategory(viewerUserId, query.category);
    const band = getCategoryLevelRange(category);

    let lat = query.lat != null && Number.isFinite(Number(query.lat)) ? Number(query.lat) : null;
    let lng = query.lng != null && Number.isFinite(Number(query.lng)) ? Number(query.lng) : null;

    if (lat != null && lng != null) {
      await this.matchesRepository.savePlayerCoordinates(viewerUserId, lat, lng);
    } else {
      const stored = await this.matchesRepository.getPlayerCoordinatesByUserId(viewerUserId);
      lat = stored.lat;
      lng = stored.lng;
    }

    const radiusKm = this.normalizeSearchRadius(query.radiusKm);

    const rows = await this.matchesRepository.listOpenForSearch({
      categoryMin: band.min,
      categoryMax: band.max,
      lat,
      lng,
      radiusKm: lat != null && lng != null ? radiusKm : null,
      zone: query.zone,
      limit: 50,
    });

    return {
      category,
      radiusKm: lat != null && lng != null ? radiusKm : null,
      matches: rows,
    };
  }

  private normalizeSearchRadius(radiusKm?: number): number {
    if (radiusKm == null || !Number.isFinite(radiusKm) || radiusKm <= 0) {
      return DEFAULT_SEARCH_RADIUS_KM;
    }
    return Math.min(radiusKm, MAX_SEARCH_RADIUS_KM);
  }

  private async resolveViewerCategory(userId: string, requested?: string): Promise<string> {
    if (requested?.trim()) return requested.trim();

    const placement = await this.matchesRepository.getPlayerPlacementBandByUserId(userId);
    if (!placement) return '5ta';

    return resolveVisibleLevelCategory({
      rating: placement.rating,
      categoryStatus: placement.categoryStatus,
      declaredCategory: placement.declaredCategory,
    });
  }

  async findOne(id: string, viewerUserId?: string) {
    await this.refreshExpiredCourtWindows();
    const match = await this.matchesRepository.getDetail(id);
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    const joinRequests = await this.matchesRepository.listJoinRequests(id);
    let viewerJoinStatus: string | null = null;
    let joinRequiresApproval = false;

    if (viewerUserId) {
      const playerId = await this.matchesRepository.getPlayerIdByUserId(viewerUserId);
      if (playerId) {
        viewerJoinStatus = await this.matchesRepository.getPlayerMatchStatus(id, playerId);
      }
      joinRequiresApproval = !(await this.playerLevelFitsMatch(viewerUserId, match));
    }

    const payload = {
      ...match,
      join_requests: joinRequests,
      viewer_join_status: viewerJoinStatus,
      join_requires_approval: joinRequiresApproval,
    };

    if (viewerUserId) {
      const deposit = await this.paymentsService.getDepositStatusForUser(id, viewerUserId);
      return { ...payload, deposit };
    }
    return payload;
  }

  async findAll() {
    await this.refreshExpiredCourtWindows();
    return this.matchesRepository.listOpen();
  }

  async getMyMatches(userId: string) {
    await this.refreshExpiredCourtWindows();
    return this.matchesRepository.listByUser(userId);
  }

  private async playerLevelFitsMatch(
    userId: string,
    match: { level_min?: number | null; level_max?: number | null },
  ): Promise<boolean> {
    const level = await this.matchesRepository.getPlayerSkillScoreByUserId(userId);
    if (level == null) return true;

    const min = match.level_min != null ? Number(match.level_min) : null;
    const max = match.level_max != null ? Number(match.level_max) : null;
    if (min == null && max == null) return true;
    if (min != null && level < min) return false;
    if (max != null && level > max) return false;
    return true;
  }

  private async assertCanManageJoinRequests(matchId: string, approverUserId: string) {
    const match = await this.matchesRepository.getById(matchId);
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.created_by_user_id === approverUserId) {
      return match;
    }

    const detail = await this.matchesRepository.getDetail(matchId);
    const isParticipant = detail?.players.some((player: { id: string }) => player.id === approverUserId);
    if (!isParticipant) {
      throw new BadRequestException('Solo el organizador o jugadores del partido pueden gestionar solicitudes');
    }

    return match;
  }

  async resolveInvites(creatorUserId: string, invites?: MatchInviteDto[]) {
    if (!invites?.length) {
      return {
        playerInvites: [] as Array<{ playerId: string; slotOrder: number }>,
        guestInvites: [] as Array<{ name: string; role: 'partner' | 'opponent'; slotOrder: number }>,
        invitedUserIds: [] as string[],
      };
    }

    const partners = invites.filter((i) => i.role === 'partner');
    const opponents = invites.filter((i) => i.role === 'opponent');

    if (partners.length > 1) {
      throw new BadRequestException('Solo podés invitar un compañero');
    }
    if (opponents.length > 2) {
      throw new BadRequestException('Solo podés invitar dos rivales');
    }

    const invitedUserIds = invites.map((i) => i.userId).filter((value): value is string => !!value);
    if (new Set(invitedUserIds).size !== invitedUserIds.length) {
      throw new BadRequestException('No podés invitar al mismo jugador más de una vez');
    }
    if (invitedUserIds.includes(creatorUserId)) {
      throw new BadRequestException('No podés invitarte a vos mismo');
    }

    const playerInvites: Array<{ playerId: string; slotOrder: number }> = [];
    const guestInvites: Array<{ name: string; role: 'partner' | 'opponent'; slotOrder: number }> = [];

    const resolveSlotOrder = (role: 'partner' | 'opponent', opponentIndex = 0) =>
      role === 'partner' ? 2 : 3 + opponentIndex;

    const pushInvite = async (invite: MatchInviteDto, slotOrder: number) => {
      if (invite.userId) {
        const invitedPlayerId = await this.matchesRepository.getPlayerIdByUserId(invite.userId);
        if (!invitedPlayerId) {
          throw new BadRequestException('Uno de los jugadores invitados no tiene perfil de jugador');
        }
        playerInvites.push({ playerId: invitedPlayerId, slotOrder });
        return;
      }
      if (invite.guestName?.trim()) {
        guestInvites.push({
          name: invite.guestName.trim(),
          role: invite.role,
          slotOrder,
        });
        return;
      }
      throw new BadRequestException('Cada invitación debe tener un jugador o un invitado externo');
    };

    if (partners[0]) {
      await pushInvite(partners[0], resolveSlotOrder('partner'));
    }
    for (const [index, opponent] of opponents.entries()) {
      await pushInvite(opponent, resolveSlotOrder('opponent', index));
    }

    return { playerInvites, guestInvites, invitedUserIds };
  }

  async joinInvitedPlayers(matchId: string, creatorUserId: string, invites?: MatchInviteDto[]) {
    const { playerInvites, guestInvites } = await this.resolveInvites(creatorUserId, invites);
    for (const invite of playerInvites) {
      await this.matchesRepository.join(matchId, invite.playerId, 'JOINED', invite.slotOrder);
    }
    for (const guest of guestInvites) {
      await this.matchesRepository.addGuestInvite({
        matchId,
        name: guest.name,
        role: guest.role,
        slotOrder: guest.slotOrder,
        invitedByUserId: creatorUserId,
        sponsorUserId: creatorUserId,
      });
    }
  }

  private async nextAvailableSlotOrder(matchId: string) {
    const slotOrder = await this.matchesRepository.getNextAvailableSlotOrder(matchId);
    if (slotOrder == null) {
      throw new BadRequestException('El partido ya no tiene cupos disponibles');
    }
    return slotOrder;
  }

  private async joinPlayerWithNextSlot(
    matchId: string,
    playerId: string,
    status: 'JOINED' | 'CONFIRMED' = 'JOINED',
  ) {
    const slotOrder = await this.nextAvailableSlotOrder(matchId);
    await this.matchesRepository.join(matchId, playerId, status, slotOrder);
  }

  private async requestJoin(matchId: string, playerId: string) {
    const existing = await this.matchesRepository.getPlayerMatchStatus(matchId, playerId);
    if (existing === 'REQUESTED') {
      throw new BadRequestException('Ya enviaste una solicitud para este partido');
    }
    if (existing === 'JOINED' || existing === 'CONFIRMED') {
      throw new BadRequestException('Ya participás de este partido');
    }

    await this.matchesRepository.join(matchId, playerId, 'REQUESTED', null);
  }

  private async syncMatchCapacityStatus(matchId: string) {
    const match = await this.matchesRepository.getById(matchId);
    if (!match) return;
    const joinedCount = await this.matchesRepository.countJoinedPlayers(matchId);
    if (joinedCount >= match.needed_players && match.status === 'OPEN') {
      await this.matchesRepository.updateStatus(matchId, 'FULL');
    }
  }

  async joinMatch(matchId: string, userId: string) {
    const match = await this.findOne(matchId);
    const playerId = await this.matchesRepository.getPlayerIdByUserId(userId);
    if (!playerId) {
      throw new BadRequestException('Debes completar perfil de jugador');
    }

    if (!['OPEN', 'FULL'].includes(match.status)) {
      throw new BadRequestException('Este partido ya no acepta jugadores');
    }

    const fitsLevel = await this.playerLevelFitsMatch(userId, match);
    const existingStatus = await this.matchesRepository.getPlayerMatchStatus(matchId, playerId);
    if (existingStatus === 'REQUESTED') {
      throw new BadRequestException('Ya enviaste una solicitud para este partido');
    }
    if (existingStatus === 'JOINED' || existingStatus === 'CONFIRMED') {
      throw new BadRequestException('Ya participás de este partido');
    }

    if (fitsLevel) {
      await this.joinPlayerWithNextSlot(matchId, playerId);
      await this.matchesRepository.createMatchChatIfMissing(matchId);

      const joinedCount = await this.matchesRepository.countJoinedPlayers(matchId);
      if (joinedCount >= match.needed_players && match.status === 'OPEN') {
        await this.matchesRepository.updateStatus(matchId, 'FULL');
      }
    } else {
      await this.requestJoin(matchId, playerId);
    }

    const updated = await this.findOne(matchId, userId);
    if (fitsLevel) {
      this.realtimeGateway.emitMatchJoined({ matchId, userId });
    }
    this.realtimeGateway.emitMatchUpdated(updated);
    return updated;
  }

  async acceptJoinRequest(matchId: string, requestUserId: string, approverUserId: string) {
    await this.assertCanManageJoinRequests(matchId, approverUserId);

    const match = await this.matchesRepository.getById(matchId);
    if (!match || !['OPEN', 'FULL'].includes(match.status)) {
      throw new BadRequestException('Este partido ya no acepta jugadores');
    }

    const requestPlayerId = await this.matchesRepository.getPlayerIdByUserId(requestUserId);
    if (!requestPlayerId) {
      throw new BadRequestException('Jugador no encontrado');
    }

    const requestStatus = await this.matchesRepository.getPlayerMatchStatus(matchId, requestPlayerId);
    if (requestStatus !== 'REQUESTED') {
      throw new BadRequestException('No hay una solicitud pendiente de este jugador');
    }

    const slotOrder = await this.nextAvailableSlotOrder(matchId);
    if (slotOrder == null) {
      throw new BadRequestException('El partido ya no tiene cupos disponibles');
    }

    await this.matchesRepository.join(matchId, requestPlayerId, 'JOINED', slotOrder);
    await this.matchesRepository.createMatchChatIfMissing(matchId);
    await this.syncMatchCapacityStatus(matchId);

    const updated = await this.findOne(matchId, approverUserId);
    this.realtimeGateway.emitMatchJoined({ matchId, userId: requestUserId });
    this.realtimeGateway.emitMatchUpdated(updated);
    return updated;
  }

  async rejectJoinRequest(matchId: string, requestUserId: string, approverUserId: string) {
    await this.assertCanManageJoinRequests(matchId, approverUserId);

    const requestPlayerId = await this.matchesRepository.getPlayerIdByUserId(requestUserId);
    if (!requestPlayerId) {
      throw new BadRequestException('Jugador no encontrado');
    }

    const requestStatus = await this.matchesRepository.getPlayerMatchStatus(matchId, requestPlayerId);
    if (requestStatus !== 'REQUESTED') {
      throw new BadRequestException('No hay una solicitud pendiente de este jugador');
    }

    await this.matchesRepository.leave(matchId, requestPlayerId);

    const updated = await this.findOne(matchId, approverUserId);
    this.realtimeGateway.emitMatchUpdated(updated);
    return updated;
  }

  async leaveMatch(matchId: string, userId: string) {
    const match = await this.matchesRepository.getById(matchId);
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }
    if (!MatchesService.LEAVABLE_STATUSES.includes(match.status)) {
      throw new BadRequestException('Ya no podés salir de este partido');
    }

    const playerId = await this.matchesRepository.getPlayerIdByUserId(userId);
    if (!playerId) {
      throw new BadRequestException('Jugador no encontrado');
    }

    const playerStatus = await this.matchesRepository.getPlayerMatchStatus(matchId, playerId);
    if (
      !playerStatus ||
      !MatchesService.ACTIVE_PLAYER_STATUSES.includes(
        playerStatus as (typeof MatchesService.ACTIVE_PLAYER_STATUSES)[number],
      )
    ) {
      throw new BadRequestException('No participás de este partido');
    }

    const isOrganizer = match.created_by_user_id === userId;
    if (isOrganizer && playerStatus !== 'REQUESTED') {
      const nextOrganizer = await this.matchesRepository.getNextOrganizerCandidate(matchId, userId);
      if (!nextOrganizer) {
        return this.cancelMatch(matchId, userId);
      }

      const depositPolicy = await this.paymentsService.settleDepositOnLeave(
        matchId,
        playerId,
        match.created_at,
      );

      await this.matchesRepository.leave(matchId, playerId);
      await this.matchesRepository.updateCreatedBy(matchId, nextOrganizer.user_id);

      if (match.status === 'FULL' || match.status === 'CONFIRMED') {
        await this.matchesRepository.updateStatus(matchId, 'OPEN');
      }

      await this.matchesRepository.notifyUsers(
        [nextOrganizer.user_id],
        'MATCH_ORGANIZER_TRANSFERRED',
        'Ahora organizás el partido',
        `Quedaste a cargo de "${match.title}" porque el organizador anterior salió.`,
        { matchId, previousOrganizerUserId: userId },
      );

      const updated = await this.findOne(matchId, userId);
      this.realtimeGateway.emitMatchLeft({ matchId, userId });
      this.realtimeGateway.emitMatchUpdated(updated);
      return {
        match: updated,
        depositPolicy,
        organizerTransferred: true,
        newOrganizerUserId: nextOrganizer.user_id,
        newOrganizerName: nextOrganizer.name,
        cancelled: false,
      };
    }

    const depositPolicy = await this.paymentsService.settleDepositOnLeave(
      matchId,
      playerId,
      match.created_at,
    );

    await this.matchesRepository.leave(matchId, playerId);

    if (match.status === 'FULL' || match.status === 'CONFIRMED') {
      await this.matchesRepository.updateStatus(matchId, 'OPEN');
    }

    const updated = await this.findOne(matchId, userId);
    this.realtimeGateway.emitMatchLeft({ matchId, userId });
    this.realtimeGateway.emitMatchUpdated(updated);
    return {
      match: updated,
      depositPolicy,
      organizerTransferred: false,
      cancelled: false,
    };
  }

  async cancelMatch(matchId: string, userId: string) {
    const match = await this.matchesRepository.getById(matchId);
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (!MatchesService.LEAVABLE_STATUSES.includes(match.status)) {
      throw new BadRequestException('Este partido no se puede cancelar en su estado actual');
    }

    const role = await this.matchesRepository.getUserRole(userId);
    const isCreator = match.created_by_user_id === userId;
    const isClubAccount = isClubRole(role ?? undefined);
    if (!isCreator && !isClubAccount) {
      throw new ForbiddenException('Solo el creador o el club pueden cancelar el partido');
    }

    const depositPolicy = await this.paymentsService.settleMatchDepositsOnCancel(
      matchId,
      match.created_at,
    );

    await this.matchesRepository.updateStatus(matchId, 'CANCELLED');

    if (match.court_slot_id) {
      await this.matchesRepository.releaseCourtSlot(match.court_slot_id);
      void this.clubGapFillService.outreachForReleasedSlot(match.court_slot_id).catch(() => undefined);
    }

    const participantIds = await this.matchesRepository.listActiveParticipantUserIds(matchId);
    const notifyIds = participantIds.filter((id) => id !== userId);
    const señaHint = depositPolicy.withinFreeWindow
      ? 'Las señas pagadas se reembolsan.'
      : depositPolicy.retained > 0
        ? 'Pasaron más de 30 minutos: las señas pagadas se retienen.'
        : '';
    await this.matchesRepository.notifyUsers(
      notifyIds,
      'MATCH_CANCELLED',
      'Partido cancelado',
      `Se canceló "${match.title}". ${señaHint}`.trim(),
      { matchId, depositPolicy },
    );

    const updated = await this.findOne(matchId, userId);
    this.realtimeGateway.emitMatchUpdated(updated);
    return { match: updated, depositPolicy, cancelled: true, organizerTransferred: false };
  }

  getDepositStatus(matchId: string, userId: string) {
    return this.paymentsService.getDepositStatusForUser(matchId, userId);
  }

  createDepositCheckout(matchId: string, userId: string) {
    return this.paymentsService.createCheckout(matchId, userId);
  }

  async simulateDepositPayment(matchId: string, userId: string) {
    const checkout = await this.paymentsService.createCheckout(matchId, userId);
    if (checkout.depositId) {
      await this.paymentsService.simulateMockPayment(checkout.depositId, userId);
    }
    const match = await this.findOne(matchId, userId);
    this.realtimeGateway.emitMatchUpdated(match);
    return { ok: true, match };
  }

  async confirmMatch(matchId: string, userId: string) {
    const match = await this.findOne(matchId);
    const playerId = await this.matchesRepository.getPlayerIdByUserId(userId);
    if (!playerId) {
      throw new BadRequestException('Jugador no encontrado');
    }

    const isParticipant = match.players.some((p: { playerId: string }) => p.playerId === playerId);
    if (!isParticipant) {
      throw new BadRequestException('No participas de este partido');
    }

    if (!['FULL', 'OPEN'].includes(match.status)) {
      throw new BadRequestException('Este partido no requiere confirmación en este estado');
    }

    await this.paymentsService.assertDepositPaid(matchId, playerId);
    await this.matchesRepository.confirmPlayer(matchId, playerId);

    const joinedCount = await this.matchesRepository.countJoinedPlayers(matchId);
    const confirmedCount = await this.matchesRepository.countConfirmedPlayers(matchId);

    if (joinedCount >= match.needed_players && confirmedCount >= match.needed_players) {
      await this.matchesRepository.updateStatus(matchId, 'CONFIRMED');
    } else if (match.status === 'OPEN' && joinedCount >= match.needed_players) {
      await this.matchesRepository.updateStatus(matchId, 'FULL');
    }

    const updated = await this.findOne(matchId);
    this.realtimeGateway.emitMatchUpdated(updated);
    return updated;
  }

  async updateMatchStatus(matchId: string, dto: UpdateMatchStatusDto) {
    if (dto.status === 'CANCELLED') {
      throw new BadRequestException('Usá POST /matches/:id/cancel para cancelar el partido');
    }
    const result = await this.matchesRepository.updateStatus(matchId, dto.status);
    const match = await this.matchesRepository.getDetail(matchId);
    this.realtimeGateway.emitMatchUpdated(match ?? result.rows[0]);
    return match ?? result.rows[0];
  }

  private async assertMatchParticipant(matchId: string, userId: string) {
    const match = await this.matchesRepository.getDetail(matchId);
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }
    const isParticipant = match.players.some((p: { id: string }) => p.id === userId);
    if (!isParticipant) {
      throw new BadRequestException('Solo los jugadores del partido pueden gestionar el resultado');
    }
    return match;
  }

  async submitResult(matchId: string, userId: string, dto: CreateMatchResultDto) {
    const match = await this.assertMatchParticipant(matchId, userId);

    if (match.status === 'DISPUTED') {
      throw new BadRequestException(
        'Este partido cerró sin acuerdo. No se pueden cargar más resultados ni puntos.',
      );
    }

    if (!['CONFIRMED', 'IN_PROGRESS', 'FINISHED'].includes(match.status)) {
      throw new BadRequestException(
        'El partido debe estar confirmado o en juego para cargar el resultado',
      );
    }

    if (match.result?.status === 'confirmed') {
      throw new BadRequestException('El resultado ya fue confirmado por todos los jugadores');
    }

    if (match.result?.disputed || match.result?.status === 'disputed') {
      throw new BadRequestException('Este partido cerró sin acuerdo');
    }

    const parsed = parseBestOfThreeSets(dto.sets);
    await this.matchesRepository.proposeResult(matchId, userId, parsed);
    await this.matchesRepository.addResultConfirmation(matchId, userId);
    await this.saveOptionalPlayerRatings(matchId, userId, dto.playerRatings);

    if (match.status !== 'IN_PROGRESS' && match.status !== 'FINISHED') {
      await this.matchesRepository.updateStatus(matchId, 'IN_PROGRESS');
    }

    const finalized = await this.tryFinalizeResultIfAllConfirmed(matchId);
    const detail = await this.findOne(matchId);
    this.realtimeGateway.emitMatchScoreUpdated({ matchId, finalized });
    this.realtimeGateway.emitMatchUpdated(detail);
    return detail.result;
  }

  async rejectResult(matchId: string, userId: string, dto?: RejectMatchResultDto) {
    const match = await this.assertMatchParticipant(matchId, userId);

    if (match.status === 'DISPUTED') {
      throw new BadRequestException('Este partido ya cerró sin acuerdo');
    }

    if (!match.result || match.result.status === 'confirmed') {
      throw new BadRequestException('No hay un resultado pendiente para rechazar');
    }

    if (match.result.submittedByUserId === userId) {
      throw new BadRequestException(
        'Si querés cambiar tu propuesta, usá "Proponer otro resultado"',
      );
    }

    if (match.result.confirmations?.some((c: { userId: string }) => c.userId === userId)) {
      throw new BadRequestException('Ya confirmaste este resultado');
    }

    await this.matchesRepository.addResultRejection(matchId, userId, dto?.comment);

    const detail = await this.findOne(matchId);
    this.realtimeGateway.emitMatchUpdated(detail);

    return {
      rejected: true,
      result: detail.result,
    };
  }

  async confirmResult(matchId: string, userId: string, dto?: ConfirmMatchResultDto) {
    const match = await this.assertMatchParticipant(matchId, userId);

    if (match.status === 'DISPUTED') {
      throw new BadRequestException('Este partido ya cerró sin acuerdo');
    }

    if (!match.result || match.result.status === 'confirmed') {
      throw new BadRequestException('No hay un resultado pendiente de confirmación');
    }

    if (match.result.rejections?.some((r: { userId: string }) => r.userId === userId)) {
      throw new BadRequestException(
        'Rechazaste este resultado. Proponé otro marcador o esperá a que la otra pareja lo actualice.',
      );
    }

    await this.matchesRepository.addResultConfirmation(matchId, userId);
    await this.saveOptionalPlayerRatings(matchId, userId, dto?.playerRatings);
    const finalized = await this.tryFinalizeResultIfAllConfirmed(matchId);
    const detail = await this.findOne(matchId);
    this.realtimeGateway.emitMatchScoreUpdated({ matchId, finalized });
    this.realtimeGateway.emitMatchUpdated(detail);

    return {
      confirmed: true,
      finalized,
      result: detail.result,
    };
  }

  private async tryFinalizeResultIfAllConfirmed(matchId: string): Promise<boolean> {
    const match = await this.matchesRepository.getDetail(matchId);
    if (!match?.result || match.result.status === 'confirmed') {
      return match?.result?.status === 'confirmed';
    }

    const participantIds = await this.matchesRepository.getParticipantUserIds(matchId);
    const confirmationCount = await this.matchesRepository.countResultConfirmations(matchId);

    if (participantIds.length === 0 || confirmationCount < participantIds.length) {
      return false;
    }

    return this.finalizeMatchWithPoints(matchId, false);
  }

  private async finalizeMatchWithPoints(matchId: string, autoFinalized: boolean) {
    const finalized = await this.matchesRepository.finalizeResult(matchId, autoFinalized);
    await this.matchesRepository.updateStatus(matchId, 'FINISHED');
    const winnerTeam = finalized.rows[0]?.winner_team as string;
    await this.clubPointsService.awardForFinishedMatch(matchId, winnerTeam);
    await this.competitiveScoringService.awardForFinishedMatch(matchId);
    await this.applyMatchRatings(matchId, winnerTeam);
    await this.advancePlacementIfCompetitive(matchId);
    await this.badgesService.evaluateForFinishedMatch(matchId);
    const detail = await this.findOne(matchId);
    this.realtimeGateway.emitMatchUpdated(detail);
    return true;
  }

  private async advancePlacementIfCompetitive(matchId: string) {
    const match = await this.matchesRepository.getById(matchId);
    if (!match || match.mode !== 'competitive' || match.tournament_id) return;

    const participants = await this.matchesRepository.getParticipantsForRating(matchId);
    const provisionalUserIds = participants
      .filter((player) => player.categoryStatus === 'provisional')
      .map((player) => player.userId);
    if (provisionalUserIds.length === 0) return;

    await this.matchesRepository.advancePlacementForCompetitiveMatch(
      provisionalUserIds,
      PLACEMENT_MATCHES_REQUIRED,
    );
  }

  private async applyMatchRatings(matchId: string, winnerTeam: string | null | undefined) {
    if (await this.matchesRepository.hasRatingHistory(matchId)) {
      return;
    }

    const match = await this.matchesRepository.getById(matchId);
    if (!match) return;

    const detail = await this.matchesRepository.getDetail(matchId);
    const sets = (detail?.result?.sets ?? []) as Array<{ teamA: number; teamB: number }>;

    const participants = await this.matchesRepository.getParticipantsForRating(matchId);
    if (participants.length < 2) {
      return;
    }

    const neededPlayers = Number(match.needed_players) || participants.length;
    const { teamA, teamB } = splitParticipantsByTeam(participants, neededPlayers);
    if (teamA.length === 0 || teamB.length === 0) {
      return;
    }

    const priorEncounters = await this.matchesRepository.countRecentTeamMatchups(
      matchId,
      teamA.map((player) => player.userId),
      teamB.map((player) => player.userId),
    );

    const normalizedWinner = String(winnerTeam || '')
      .toUpperCase()
      .trim();
    const winner: 'A' | 'B' | null =
      normalizedWinner === 'A' ? 'A' : normalizedWinner === 'B' ? 'B' : null;

    const changes = computeMatchRatingChanges({
      participants: participants.map((player) => ({
        userId: player.userId,
        rating: resolvePlayerRating(player),
        rank: player.rank,
        kFactor: player.categoryStatus === 'provisional' ? PLACEMENT_ELO_K_FACTOR : undefined,
      })),
      neededPlayers,
      winnerTeam: winner,
      priorEncounters,
      sets,
    });

    await this.matchesRepository.savePlayerRatingHistory(
      matchId,
      changes.map((change) => ({
        userId: change.userId,
        ratingBefore: change.ratingBefore,
        ratingAfter: change.ratingAfter,
        delta: change.delta,
      })),
    );
  }

  private async saveOptionalPlayerRatings(
    matchId: string,
    raterUserId: string,
    ratings?: PlayerRatingDto[],
  ) {
    if (!ratings?.length) return;
    const participantIds = await this.matchesRepository.getParticipantUserIds(matchId);
    await this.matchesRepository.savePlayerRatings(
      matchId,
      raterUserId,
      ratings,
      participantIds,
    );
  }

  /** Sin acuerdo en 48h: disputa, sin puntos; habilita reseñas a rivales. */
  async processExpiredPendingResults(): Promise<number> {
    const expired = await this.matchesRepository.listExpiredPendingResults();
    let processed = 0;

    for (const row of expired) {
      await this.closeMatchAsDisputed(row.match_id);
      processed += 1;
    }

    return processed;
  }

  async closeMatchAsDisputed(matchId: string) {
    await this.matchesRepository.closeAsDisputedWithoutPoints(matchId);
    const detail = await this.findOne(matchId);
    this.realtimeGateway.emitMatchUpdated(detail);
    return detail;
  }

  async submitRivalReviews(matchId: string, userId: string, dto: ConfirmMatchResultDto) {
    const match = await this.findOne(matchId, userId);
    if (match.status !== 'DISPUTED') {
      throw new BadRequestException('Solo podés dejar reseñas en partidos cerrados sin acuerdo');
    }
    if (!match.can_submit_rival_reviews) {
      throw new BadRequestException('El plazo para dejar reseñas a rivales ya venció');
    }

    const isParticipant = match.players.some((p: { id: string }) => p.id === userId);
    if (!isParticipant) {
      throw new BadRequestException('Solo los jugadores del partido pueden dejar reseñas');
    }

    const opponents = await this.matchesRepository.getOpponentUserIds(matchId, userId);
    const ratings = (dto.playerRatings ?? []).filter((r) => opponents.includes(r.userId));

    if (ratings.length > 0) {
      await this.matchesRepository.savePlayerRatings(matchId, userId, ratings, opponents);
    }

    const detail = await this.findOne(matchId, userId);
    return {
      saved: ratings.length,
      result: detail.result,
      canSubmitRivalReviews: detail.can_submit_rival_reviews,
    };
  }

  async addInvites(matchId: string, inviterUserId: string, dto: AddMatchInvitesDto) {
    const invites = dto.invites ?? [];
    if (!invites.length) {
      throw new BadRequestException('Indicá al menos un invitado');
    }

    const match = await this.matchesRepository.getById(matchId);
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (!['OPEN', 'FULL'].includes(String(match.status))) {
      throw new BadRequestException('Este partido ya no acepta invitaciones');
    }

    const detail = await this.matchesRepository.getDetail(matchId);
    if (!detail) {
      throw new NotFoundException('Partido no encontrado');
    }

    const isOrganizer = match.created_by_user_id === inviterUserId;
    const isParticipant = detail.players.some((player: { id: string }) => player.id === inviterUserId);
    if (!isOrganizer && !isParticipant) {
      throw new ForbiddenException('Solo jugadores del partido pueden invitar');
    }

    const joinedCount = await this.matchesRepository.countJoinedPlayers(matchId);
    const availableSlots = Number(match.needed_players) - joinedCount;
    if (availableSlots <= 0) {
      throw new BadRequestException('El partido ya está completo');
    }
    if (invites.length > availableSlots) {
      throw new BadRequestException(
        availableSlots === 1
          ? 'Solo queda 1 lugar disponible'
          : `Solo quedan ${availableSlots} lugares disponibles`,
      );
    }

    const existingUserIds = new Set(
      detail.players.map((player: { id: string }) => player.id).filter(Boolean),
    );
    const invitedUserIds = invites.map((invite) => invite.userId).filter((value): value is string => !!value);
    if (new Set(invitedUserIds).size !== invitedUserIds.length) {
      throw new BadRequestException('No podés invitar al mismo jugador más de una vez');
    }
    for (const userId of invitedUserIds) {
      if (userId === inviterUserId) {
        throw new BadRequestException('No podés invitarte a vos mismo');
      }
      if (existingUserIds.has(userId)) {
        throw new BadRequestException('Uno de los jugadores ya forma parte del partido');
      }
    }

    for (const invite of invites) {
      const slotOrder = await this.nextAvailableSlotOrder(matchId);
      const role = invite.role ?? 'opponent';

      if (invite.userId) {
        const invitedPlayerId = await this.matchesRepository.getPlayerIdByUserId(invite.userId);
        if (!invitedPlayerId) {
          throw new BadRequestException('Uno de los jugadores invitados no tiene perfil de jugador');
        }
        await this.matchesRepository.join(matchId, invitedPlayerId, 'JOINED', slotOrder);
        existingUserIds.add(invite.userId);
        continue;
      }

      if (invite.guestName?.trim()) {
        await this.matchesRepository.addGuestInvite({
          matchId,
          name: invite.guestName.trim(),
          role,
          slotOrder,
          invitedByUserId: inviterUserId,
          sponsorUserId: inviterUserId,
        });
        continue;
      }

      throw new BadRequestException('Cada invitación debe tener un jugador o un invitado externo');
    }

    await this.syncMatchCapacityStatus(matchId);
    const updated = await this.findOne(matchId, inviterUserId);
    this.realtimeGateway.emitMatchUpdated(updated);
    return updated;
  }
}
