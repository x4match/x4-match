import { Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeCategoryStatus,
  PLACEMENT_MATCHES_REQUIRED,
  resolvePlayerRating,
  resolveVisibleLevelCategory,
} from '../common/utils';
import { ratingToSkillScore } from '../common/utils/player-rating.util';
import { UsersService } from '../users/users.service';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayersRepository } from './players.repository';

@Injectable()
export class PlayersService {
  constructor(
    private readonly playersRepository: PlayersRepository,
    private readonly usersService: UsersService,
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
    return {
      ...player,
      rating,
      skillScore: ratingToSkillScore(rating),
      level: player.level != null ? Number(player.level) : null,
      levelCategory: resolveVisibleLevelCategory({
        rating,
        categoryStatus,
        declaredCategory,
      }),
      declaredCategory,
      categoryStatus,
      placementMatchesPlayed,
      placementMatchesRequired: PLACEMENT_MATCHES_REQUIRED,
      gender: typeof extras.gender === 'string' ? extras.gender : undefined,
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

  async getById(playerId: string) {
    let player = this.normalizePlayer(await this.playersRepository.getById(playerId));
    if (!player) {
      player = this.normalizePlayer(await this.playersRepository.getByUserId(playerId));
    }
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }

    const matchStats = await this.usersService.getMatchStats(player.user_id);
    return {
      ...player,
      match_stats: matchStats,
    };
  }

  async getMatchHistory(playerId: string, limit?: number) {
    let player = await this.playersRepository.getById(playerId);
    if (!player) {
      player = await this.playersRepository.getByUserId(playerId);
    }
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
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
      zone: row.zone,
      city: row.city,
    }));
  }
}
