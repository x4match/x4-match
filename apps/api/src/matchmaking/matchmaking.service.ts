import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AvailabilityService } from '../availability/availability.service';
import { MatchesRepository } from '../matches/matches.repository';
import { MatchesService } from '../matches/matches.service';
import { MatchInviteDto } from '../matches/dto/match-invite.dto';
import { getCategoryLevelRange, defaultLevelBand } from '../common/utils/level-range.util';
import { ratingToSkillScore } from '../common/utils';

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly availabilityService: AvailabilityService,
    private readonly matchesRepository: MatchesRepository,
    private readonly matchesService: MatchesService,
  ) {}

  async createMatchRequest(
    userId: string,
    data: {
      clubId?: string;
      date: Date;
      startHour: number;
      endHour: number;
      minRating?: number;
      maxRating?: number;
      category?: string;
    },
  ) {
    let levelMin = data.minRating ?? null;
    let levelMax = data.maxRating ?? null;

    if (data.category && levelMin == null && levelMax == null) {
      const range = getCategoryLevelRange(data.category);
      levelMin = range.min;
      levelMax = range.max;
    }

    if (levelMin == null || levelMax == null) {
      const playerLevel = await this.matchesRepository.getPlayerSkillScoreByUserId(userId);
      const band = defaultLevelBand(playerLevel ?? 400);
      levelMin = levelMin ?? band.min;
      levelMax = levelMax ?? band.max;
    }

    const result = await this.db.query(
      `INSERT INTO match_requests (
         user_id, club_id, match_date, start_hour, end_hour, level_min, level_max, category
       ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        data.clubId ?? null,
        data.date,
        data.startHour,
        data.endHour,
        levelMin,
        levelMax,
        data.category ?? null,
      ],
    );
    return result.rows[0];
  }

  /**
   * Busca jugadores por disponibilidad y nivel, arma partido de 4 y confirma al creador.
   */
  async runMatchmaking(
    matchRequestId: string,
    userId: string,
    invites?: MatchInviteDto[],
    mode: 'friendly' | 'competitive' = 'friendly',
    gender: 'male' | 'female' | 'mixed' | 'open' = 'open',
  ) {
    const requestResult = await this.db.query(
      `SELECT mr.*, u.name AS creator_name, p.rating AS creator_rating
       FROM match_requests mr
       INNER JOIN users u ON u.id = mr.user_id
       LEFT JOIN players p ON p.user_id = mr.user_id
       WHERE mr.id = $1`,
      [matchRequestId],
    );
    const matchRequest = requestResult.rows[0];

    if (!matchRequest) {
      throw new NotFoundException('Solicitud de partido no encontrada');
    }
    if (matchRequest.user_id !== userId) {
      throw new BadRequestException('No podés ejecutar matchmaking de otro usuario');
    }
    if (matchRequest.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    const { playerInvites, guestInvites, invitedUserIds } = await this.matchesService.resolveInvites(
      userId,
      invites,
    );
    const slotsToFill = 3 - playerInvites.length - guestInvites.length;
    if (slotsToFill < 0) {
      throw new BadRequestException('Solo podés invitar hasta 3 jugadores (1 compañero y 2 rivales)');
    }

    const resolvedGender = await this.matchesService.resolveGenderForInvites(
      userId,
      invites,
      gender,
      mode,
    );

    const matchDate = new Date(matchRequest.match_date);
    let autoSelected: { player_id: string; user_id: string; skill_score: number }[] = [];

    if (slotsToFill > 0) {
      const candidates = await this.availabilityService.findAvailablePlayers({
        date: matchDate,
        startHour: matchRequest.start_hour,
        endHour: matchRequest.end_hour,
        clubId: matchRequest.club_id || undefined,
        levelMin: matchRequest.level_min != null ? Number(matchRequest.level_min) : undefined,
        levelMax: matchRequest.level_max != null ? Number(matchRequest.level_max) : undefined,
        excludeUserIds: [matchRequest.user_id, ...invitedUserIds],
      });

      if (candidates.length < slotsToFill) {
        throw new BadRequestException(
          `No hay suficientes jugadores disponibles (encontrados: ${candidates.length}, necesarios: ${slotsToFill})`,
        );
      }

      const creatorLevel = ratingToSkillScore(
        matchRequest.creator_rating != null ? Number(matchRequest.creator_rating) : 1000,
      );
      const sorted = [...candidates].sort(
        (a, b) =>
          Math.abs(Number(a.skill_score) - creatorLevel) - Math.abs(Number(b.skill_score) - creatorLevel),
      );
      autoSelected = sorted.slice(0, slotsToFill);
    }

    const startAt = new Date(matchDate);
    startAt.setHours(Number(matchRequest.start_hour), 0, 0, 0);

    const endHour = Number(matchRequest.end_hour);
    const endsAt = new Date(matchDate);
    if (endHour >= 24) {
      endsAt.setDate(endsAt.getDate() + 1);
      endsAt.setHours(0, 0, 0, 0);
    } else {
      endsAt.setHours(endHour, 0, 0, 0);
    }

    const matchInsert = await this.db.query(
      `INSERT INTO matches (
         club_id, created_by_user_id, title, description, date, ends_at, zone,
         level_min, level_max, gender, mode, needed_players, status
       ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, 4, 'FULL')
       RETURNING *`,
      [
        matchRequest.club_id ?? null,
        userId,
        mode === 'competitive' ? 'Partido competitivo' : 'Partido matchmaking',
        'Armado automáticamente según disponibilidad y nivel',
        startAt.toISOString(),
        endsAt.toISOString(),
        matchRequest.level_min,
        matchRequest.level_max,
        resolvedGender,
        mode,
      ],
    );
    const match = matchInsert.rows[0];

    const creatorPlayerId = await this.matchesRepository.getPlayerIdByUserId(userId);
    if (!creatorPlayerId) {
      throw new BadRequestException('Completá tu perfil de jugador antes de buscar partido');
    }

    await this.matchesRepository.join(match.id, creatorPlayerId, 'CONFIRMED', 1);
    for (const invite of playerInvites) {
      await this.matchesRepository.join(match.id, invite.playerId, 'JOINED', invite.slotOrder);
    }
    for (const guest of guestInvites) {
      await this.matchesRepository.addGuestInvite({
        matchId: match.id,
        name: guest.name,
        role: guest.role,
        slotOrder: guest.slotOrder,
        invitedByUserId: userId,
        sponsorUserId: userId,
      });
    }
    for (const player of autoSelected) {
      const slotOrder = await this.matchesRepository.getNextAvailableSlotOrder(match.id);
      await this.matchesRepository.join(match.id, player.player_id, 'JOINED', slotOrder ?? undefined);
    }

    await this.matchesRepository.createMatchChatIfMissing(match.id);

    await this.db.query(`UPDATE match_requests SET status = 'MATCHED' WHERE id = $1`, [
      matchRequestId,
    ]);

    return this.matchesRepository.getDetail(match.id);
  }

  async getMyMatchRequests(userId: string) {
    const result = await this.db.query(
      `SELECT mr.*, u.name AS user_name
       FROM match_requests mr
       INNER JOIN users u ON u.id = mr.user_id
       WHERE mr.user_id = $1
       ORDER BY mr.created_at DESC`,
      [userId],
    );
    return result.rows;
  }
}
