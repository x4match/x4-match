import { Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeCategoryStatus,
  PLACEMENT_MATCHES_REQUIRED,
  resolvePlayerRating,
  resolveVisibleLevelCategory,
} from '../common/utils';
import { ratingToSkillScore } from '../common/utils/player-rating.util';
import { UsersService } from '../users/users.service';
import { ReportsService } from '../reports/reports.service';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayersRepository } from './players.repository';

@Injectable()
export class PlayersService {
  constructor(
    private readonly playersRepository: PlayersRepository,
    private readonly usersService: UsersService,
    private readonly reportsService: ReportsService,
  ) {}

  private normalizePlayer<T extends Record<string, any> | null>(player: T): T {
    if (!player) return player;
    const rating = resolvePlayerRating(player);
    const extras =
      player.extras && typeof player.extras === 'object' && !Array.isArray(player.extras)
        ? player.extras
        : {};
    const declaredCategory =
      typeof extras.declaredCategory === 'string' ? extras.declaredCategory : undefined;
    const categoryStatus = normalizeCategoryStatus(
      player.category_status ?? player.categoryStatus,
    );
    const placementMatchesPlayed = Number(
      player.placement_matches_played ?? player.placementMatchesPlayed ?? 0,
    );
    const prefs =
      extras.preferences && typeof extras.preferences === 'object' && !Array.isArray(extras.preferences)
        ? (extras.preferences as Record<string, unknown>)
        : {};
    const preferredHand =
      typeof prefs.preferredHand === 'string' && prefs.preferredHand.trim()
        ? prefs.preferredHand.trim()
        : undefined;
    const courtPosition =
      (typeof prefs.courtPosition === 'string' && prefs.courtPosition.trim()
        ? prefs.courtPosition.trim()
        : undefined) ||
      (typeof player.position === 'string' && player.position.trim()
        ? player.position.trim()
        : undefined);
    const birthDate =
      typeof extras.birthDate === 'string' && extras.birthDate.trim()
        ? extras.birthDate.trim()
        : undefined;
    const location =
      (typeof extras.location === 'string' && extras.location.trim()
        ? extras.location.trim()
        : undefined) ||
      (player.city ? String(player.city) : undefined);
    return {
      ...player,
      rating,
      skillScore: ratingToSkillScore(rating),
      level: player.level != null ? Number(player.level) : null,
      levelCategory: resolveVisibleLevelCategory({
        rating,
        categoryStatus,
        declaredCategory,
        lockDeclaredCategory: Boolean(extras.fejubaId || extras.fejubaCategory),
      }),
      declaredCategory,
      categoryStatus,
      placementMatchesPlayed,
      placementMatchesRequired: PLACEMENT_MATCHES_REQUIRED,
      gender: typeof extras.gender === 'string' ? extras.gender : undefined,
      birthDate,
      preferredHand,
      courtPosition,
      position: courtPosition ?? player.position,
      location,
    };
  }

  async getMe(userId: string) {
    const player = this.normalizePlayer(await this.playersRepository.getByUserId(userId));
    if (!player) {
      throw new NotFoundException('Perfil de jugador no encontrado');
    }
    return player;
  }

  updateMe(userId: string, dto: UpdatePlayerDto) {
    return this.playersRepository.updateMe(userId, dto).then((player) => this.normalizePlayer(player));
  }

  list() {
    return this.playersRepository.listPlayers().then((players) => players.map((player) => this.normalizePlayer(player)));
  }

  async getById(playerId: string, viewerUserId?: string) {
    let player = this.normalizePlayer(await this.playersRepository.getById(playerId));
    if (!player) {
      player = this.normalizePlayer(await this.playersRepository.getByUserId(playerId));
    }
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }

    if (viewerUserId) {
      await this.reportsService.assertNotBlockedEitherWay(viewerUserId, player.user_id);
    }

    const matchStats = await this.usersService.getMatchStats(player.user_id);
    const extras =
      player.extras && typeof player.extras === 'object' && !Array.isArray(player.extras)
        ? player.extras
        : {};
    const profileExtras = await this.playersRepository.getPublicProfileExtras(
      player.user_id,
      extras,
    );

    return {
      ...player,
      match_stats: matchStats,
      ...profileExtras,
    };
  }

  async getMatchHistory(playerId: string, limit?: number, viewerUserId?: string) {
    let player = await this.playersRepository.getById(playerId);
    if (!player) {
      player = await this.playersRepository.getByUserId(playerId);
    }
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }
    if (viewerUserId) {
      await this.reportsService.assertNotBlockedEitherWay(viewerUserId, player.user_id);
    }
    return this.usersService.getMatchHistory(player.user_id, limit);
  }

  async search(query: string | undefined, excludeUserId: string) {
    const q = query?.trim() ?? '';
    if (q.length < 2) {
      return [];
    }
    const result = await this.playersRepository.searchPlayers(q, excludeUserId);
    return result.rows.map((row) => ({
      ...this.normalizePlayer(row),
      id: row.id,
      userId: row.user_id,
      name: row.name,
      nickname: row.nickname,
      photo: row.photo_url,
      city: row.city,
    }));
  }
}
