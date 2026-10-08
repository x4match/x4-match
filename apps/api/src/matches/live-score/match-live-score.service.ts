import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchesRepository } from '../matches.repository';
import { MatchesService } from '../matches.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { userTeamFromRank } from '../../common/utils/match-result.util';
import {
  LiveScoreConfig,
  LiveScoreState,
  LiveTeam,
  applyLivePoint,
  createInitialLiveState,
  describeLivePoints,
  liveSetsForResult,
  pressurePoints,
} from '../../common/utils/live-score.util';
import { LiveScoreRow, MatchLiveScoreRepository } from './match-live-score.repository';
import { StartLiveScoreDto } from './dto/start-live-score.dto';

const STARTABLE_MATCH_STATUSES = ['FULL', 'CONFIRMED', 'IN_PROGRESS'];

type MatchDetail = NonNullable<Awaited<ReturnType<MatchesRepository['getDetail']>>>;

type LiveTeamMember = { id: string; name: string; photo: string | null; isGuest: boolean };

@Injectable()
export class MatchLiveScoreService {
  constructor(
    private readonly liveRepository: MatchLiveScoreRepository,
    private readonly matchesRepository: MatchesRepository,
    private readonly matchesService: MatchesService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getLive(matchId: string, viewerUserId: string) {
    const match = await this.getMatchOrThrow(matchId);
    const row = await this.liveRepository.get(matchId);
    return this.withViewer(this.buildPayload(match, row), match, row, viewerUserId);
  }

  async start(matchId: string, userId: string, dto: StartLiveScoreDto) {
    const match = await this.getMatchOrThrow(matchId);
    this.assertParticipant(match, userId);

    if (!STARTABLE_MATCH_STATUSES.includes(match.status)) {
      throw new BadRequestException('El partido tiene que estar completo para llevar el marcador');
    }
    if (match.result) {
      throw new BadRequestException(
        'Este partido ya tiene un resultado cargado. Gestionalo desde el detalle del partido.',
      );
    }
    const existing = await this.liveRepository.get(matchId);
    if (existing?.status === 'LIVE') {
      throw new ConflictException('El marcador en vivo ya está en curso');
    }

    const teams = this.buildTeams(match);
    if (teams.A.length === 0 || teams.B.length === 0) {
      throw new BadRequestException('Faltan jugadores para armar las dos parejas');
    }

    await this.liveRepository.create(
      matchId,
      userId,
      dto.deuceMode ?? 'advantage',
      dto.superTiebreak === true,
      createInitialLiveState(),
    );
    if (match.status !== 'IN_PROGRESS') {
      await this.matchesRepository.updateStatus(matchId, 'IN_PROGRESS');
    }
    return this.publish(matchId, userId);
  }

  async addPoint(matchId: string, userId: string, team: LiveTeam, expectedVersion?: number) {
    const match = await this.getMatchOrThrow(matchId);
    this.assertParticipant(match, userId);

    const finishedState = await this.liveRepository.transaction(async (client) => {
      const row = await this.liveRepository.lockForUpdate(client, matchId);
      this.assertLive(row, expectedVersion);
      const next = applyLivePoint(row!.state, this.configOf(row!), team);
      await this.liveRepository.saveState(client, matchId, userId, next, [
        ...(row!.history ?? []),
        row!.state,
      ]);
      return next.winner ? next : null;
    });

    if (finishedState) {
      await this.matchesService.submitResult(matchId, userId, {
        sets: liveSetsForResult(finishedState),
      });
    }
    return this.publish(matchId, userId);
  }

  async undo(matchId: string, userId: string, expectedVersion?: number) {
    const match = await this.getMatchOrThrow(matchId);
    this.assertParticipant(match, userId);

    await this.liveRepository.transaction(async (client) => {
      const row = await this.liveRepository.lockForUpdate(client, matchId);
      this.assertLive(row, expectedVersion);
      const history = [...(row!.history ?? [])];
      const previous = history.pop();
      if (!previous) {
        throw new BadRequestException('No hay puntos para deshacer');
      }
      await this.liveRepository.saveState(client, matchId, userId, previous, history);
    });
    return this.publish(matchId, userId);
  }

  async discard(matchId: string, userId: string) {
    const match = await this.getMatchOrThrow(matchId);
    this.assertParticipant(match, userId);
    const row = await this.liveRepository.get(matchId);
    if (!row) throw new NotFoundException('No hay marcador en vivo para este partido');
    if (row.status !== 'LIVE') {
      throw new BadRequestException(
        'El partido ya terminó y el resultado se envió. Corregilo desde el detalle del partido.',
      );
    }
    await this.liveRepository.remove(matchId);
    return this.publish(matchId, userId);
  }

  private async publish(matchId: string, viewerUserId: string) {
    const match = await this.getMatchOrThrow(matchId);
    const row = await this.liveRepository.get(matchId);
    const payload = this.buildPayload(match, row);
    this.realtimeGateway.emitMatchLiveScore(matchId, payload);
    return this.withViewer(payload, match, row, viewerUserId);
  }

  private async getMatchOrThrow(matchId: string): Promise<MatchDetail> {
    const match = await this.matchesRepository.getDetail(matchId);
    if (!match) throw new NotFoundException('Partido no encontrado');
    return match;
  }

  private isParticipant(match: MatchDetail, userId: string) {
    return match.players.some((p: { id: string }) => p.id === userId);
  }

  private assertParticipant(match: MatchDetail, userId: string) {
    if (!this.isParticipant(match, userId)) {
      throw new ForbiddenException('Solo los jugadores del partido pueden llevar el marcador');
    }
  }

  private assertLive(row: LiveScoreRow | null, expectedVersion?: number) {
    if (!row) throw new NotFoundException('El marcador en vivo no está iniciado');
    if (row.status !== 'LIVE') throw new BadRequestException('El partido ya terminó');
    if (expectedVersion != null && expectedVersion !== row.version) {
      throw new ConflictException(
        'Otro jugador actualizó el marcador recién. Revisalo antes de sumar el punto.',
      );
    }
  }

  private configOf(row: LiveScoreRow): LiveScoreConfig {
    return { deuceMode: row.deuce_mode, superTiebreak: row.super_tiebreak };
  }

  /** Mismo criterio de parejas que el resto de la app: primera mitad de slots = equipo A. */
  private buildTeams(match: MatchDetail): Record<LiveTeam, LiveTeamMember[]> {
    const neededPlayers = Number(match.needed_players) || 4;
    const slots = [
      ...match.players.map((p: { id: string; name: string; photo?: string; slotOrder?: number }) => ({
        id: p.id,
        name: p.name,
        photo: p.photo ?? null,
        isGuest: false,
        slotOrder: p.slotOrder,
      })),
      ...(match.guest_invites ?? []).map((g: { id: string; name: string; slotOrder?: number }) => ({
        id: g.id,
        name: g.name,
        photo: null,
        isGuest: true,
        slotOrder: g.slotOrder,
      })),
    ].sort((a, b) => (a.slotOrder ?? 999) - (b.slotOrder ?? 999));

    const teams: Record<LiveTeam, LiveTeamMember[]> = { A: [], B: [] };
    slots.forEach(({ slotOrder, ...member }, index) => {
      teams[userTeamFromRank(slotOrder ?? index + 1, neededPlayers)].push(member);
    });
    return teams;
  }

  private buildPayload(match: MatchDetail, row: LiveScoreRow | null) {
    const teams = this.buildTeams(match);
    if (!row) {
      return {
        matchId: match.id as string,
        status: 'NOT_STARTED' as const,
        teams,
      };
    }

    const config = this.configOf(row);
    const state: LiveScoreState = row.state;
    return {
      matchId: match.id as string,
      status: row.status,
      teams,
      config,
      sets: state.sets,
      games: state.games,
      points: state.points,
      phase: state.phase,
      winner: state.winner,
      display: describeLivePoints(state, config),
      ...pressurePoints(state, config),
      totalPoints: state.totalPoints,
      canUndo: row.status === 'LIVE' && (row.history?.length ?? 0) > 0,
      version: row.version,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      finishedAt: row.finished_at,
      startedBy: row.started_by_user_id
        ? { id: row.started_by_user_id, name: row.started_by_name }
        : null,
      lastUpdatedBy: row.last_updated_by_user_id
        ? { id: row.last_updated_by_user_id, name: row.last_updated_by_name }
        : null,
    };
  }

  private withViewer(
    payload: ReturnType<MatchLiveScoreService['buildPayload']>,
    match: MatchDetail,
    row: LiveScoreRow | null,
    viewerUserId: string,
  ) {
    const participant = this.isParticipant(match, viewerUserId);
    return {
      ...payload,
      viewer: {
        isParticipant: participant,
        canScore: participant && row?.status === 'LIVE',
        canStart:
          participant &&
          row?.status !== 'LIVE' &&
          !match.result &&
          STARTABLE_MATCH_STATUSES.includes(match.status),
      },
    };
  }
}
