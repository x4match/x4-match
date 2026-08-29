import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getWeekKey, getLevelCategory, getCategoryRatingRange } from '../common/utils';

@Injectable()
export class RankingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ranking semanal por club y categoría.
   * Usa PointsEvent como fuente de verdad, filtrado por weekKey.
   */
  async getWeeklyRanking(clubId?: string, category?: string, weekKey?: string) {
    const currentWeekKey = weekKey || getWeekKey();

    // Buscar snapshot reciente
    const snapshot = await this.prisma.rankingSnapshot.findFirst({
      where: {
        type: 'WEEKLY',
        clubId: clubId || null,
        category: category || null,
        weekKey: currentWeekKey,
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (snapshot && this.isSnapshotRecent(snapshot.generatedAt)) {
      return {
        weekKey: currentWeekKey,
        clubId: clubId || null,
        category: category || null,
        entries: snapshot.entries as any[],
      };
    }

    // Generar nuevo ranking
    const entries = await this.generateWeeklyRanking(clubId, category, currentWeekKey);

    return {
      weekKey: currentWeekKey,
      clubId: clubId || null,
      category: category || null,
      entries,
    };
  }

  /**
   * Ranking mensual (simplificado para MVP).
   */
  async getMonthlyRanking(clubId?: string, category?: string) {
    const snapshot = await this.prisma.rankingSnapshot.findFirst({
      where: {
        type: 'MONTHLY',
        clubId: clubId || null,
        category: category || null,
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (snapshot && this.isSnapshotRecent(snapshot.generatedAt, 'monthly')) {
      return {
        clubId: clubId || null,
        category: category || null,
        entries: snapshot.entries as any[],
      };
    }

    const entries = await this.generateMonthlyRanking(clubId, category);
    return {
      clubId: clubId || null,
      category: category || null,
      entries,
    };
  }

  /**
   * Generar ranking semanal usando PointsEvent.
   * Agrupado por playerId, sumando points donde weekKey y clubId coinciden.
   * Filtra por categoría usando el rango de rating del jugador.
   */
  private async generateWeeklyRanking(clubId?: string, category?: string, weekKey?: string) {
    const currentWeekKey = weekKey || getWeekKey();

    // Filtro de rating por categoría
    let ratingFilter: { gte?: number; lte?: number } | undefined;
    if (category) {
      const range = getCategoryRatingRange(category);
      ratingFilter = { gte: range.min, lte: range.max };
    }

    // Obtener puntos agrupados por jugador
    const pointsGroups = await this.prisma.pointsEvent.groupBy({
      by: ['playerId'],
      where: {
        weekKey: currentWeekKey,
        ...(clubId ? { clubId } : {}),
      },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
    });

    if (pointsGroups.length === 0) {
      return [];
    }

    // Obtener datos de los jugadores
    const playerIds = pointsGroups.map((g) => g.playerId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: playerIds },
        ...(ratingFilter ? { rating: ratingFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        photo: true,
        rating: true,
      },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    const entries = pointsGroups
      .filter((g) => usersMap.has(g.playerId))
      .map((g, index) => {
        const user = usersMap.get(g.playerId)!;
        return {
          userId: user.id,
          name: user.name,
          photo: user.photo,
          rating: user.rating,
          levelCategory: getLevelCategory(user.rating),
          points: g._sum.points || 0,
          position: index + 1,
        };
      });

    // Guardar snapshot
    await this.prisma.rankingSnapshot.create({
      data: {
        type: 'WEEKLY',
        clubId: clubId || null,
        category: category || null,
        weekKey: currentWeekKey,
        entries,
      },
    });

    return entries;
  }

  /**
   * Ranking mensual simplificado.
   */
  private async generateMonthlyRanking(clubId?: string, category?: string) {
    let ratingFilter: { gte?: number; lte?: number } | undefined;
    if (category) {
      const range = getCategoryRatingRange(category);
      ratingFilter = { gte: range.min, lte: range.max };
    }

    const users = await this.prisma.user.findMany({
      where: {
        ...(ratingFilter ? { rating: ratingFilter } : {}),
      },
      orderBy: { monthlyPoints: 'desc' },
      take: 100,
    });

    const entries = users.map((user, index) => ({
      userId: user.id,
      name: user.name,
      photo: user.photo,
      rating: user.rating,
      levelCategory: getLevelCategory(user.rating),
      points: user.monthlyPoints,
      position: index + 1,
    }));

    await this.prisma.rankingSnapshot.create({
      data: {
        type: 'MONTHLY',
        clubId: clubId || null,
        category: category || null,
        entries,
      },
    });

    return entries;
  }

  /**
   * Jugador de la semana para un club.
   * Retorna el jugador con más puntos en la semana actual.
   */
  async getPlayerOfTheWeek(clubId: string) {
    const currentWeekKey = getWeekKey();

    const topPlayer = await this.prisma.pointsEvent.groupBy({
      by: ['playerId'],
      where: {
        clubId,
        weekKey: currentWeekKey,
      },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 1,
    });

    if (topPlayer.length === 0) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: topPlayer[0].playerId },
      select: {
        id: true,
        name: true,
        photo: true,
        rating: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      levelCategory: getLevelCategory(user.rating),
      weeklyPoints: topPlayer[0]._sum.points || 0,
      weekKey: currentWeekKey,
    };
  }

  /**
   * Ranking de un club (top N jugadores).
   */
  async getClubRanking(clubId: string, limit = 10) {
    const currentWeekKey = getWeekKey();

    const pointsGroups = await this.prisma.pointsEvent.groupBy({
      by: ['playerId'],
      where: {
        clubId,
        weekKey: currentWeekKey,
      },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    if (pointsGroups.length === 0) return [];

    const playerIds = pointsGroups.map((g) => g.playerId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: playerIds } },
      select: {
        id: true,
        name: true,
        photo: true,
        rating: true,
      },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    return pointsGroups
      .filter((g) => usersMap.has(g.playerId))
      .map((g, index) => {
        const user = usersMap.get(g.playerId)!;
        return {
          position: index + 1,
          userId: user.id,
          name: user.name,
          photo: user.photo,
          rating: user.rating,
          levelCategory: getLevelCategory(user.rating),
          points: g._sum.points || 0,
        };
      });
  }

  private isSnapshotRecent(generatedAt: Date, type: 'weekly' | 'monthly' = 'weekly'): boolean {
    const now = new Date();
    const diff = now.getTime() - generatedAt.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (type === 'weekly') {
      return hours < 1; // Cache de 1 hora para semanal
    }
    return hours < 24; // Cache de 24 horas para mensual
  }
}
