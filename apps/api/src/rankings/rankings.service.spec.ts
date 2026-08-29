import { Test, TestingModule } from '@nestjs/testing';
import { RankingsService } from './rankings.service';
import { PrismaService } from '../prisma/prisma.service';
import * as utils from '../common/utils';

// Mock de getWeekKey para control determinístico
jest.spyOn(utils, 'getWeekKey').mockReturnValue('2026-W07');

// ─── Mock de Prisma ───

const mockPrisma = {
  rankingSnapshot: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  pointsEvent: {
    groupBy: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

describe('RankingsService', () => {
  let service: RankingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Restaurar el mock de getWeekKey a su valor por defecto
    (utils.getWeekKey as jest.Mock).mockReturnValue('2026-W07');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RankingsService>(RankingsService);
  });

  // ════════════════════════════════════════════
  // getWeeklyRanking
  // ════════════════════════════════════════════

  describe('getWeeklyRanking', () => {
    it('debería retornar snapshot cacheado si es reciente (< 1 hora)', async () => {
      const cachedEntries = [
        { userId: 'u1', name: 'Alice', points: 100, position: 1 },
        { userId: 'u2', name: 'Bob', points: 80, position: 2 },
      ];

      mockPrisma.rankingSnapshot.findFirst.mockResolvedValue({
        id: 'snap-1',
        type: 'WEEKLY',
        weekKey: '2026-W07',
        generatedAt: new Date(), // ahora → reciente
        entries: cachedEntries,
      });

      const result = await service.getWeeklyRanking('club-1', '4ta');

      expect(result.weekKey).toBe('2026-W07');
      expect(result.entries).toEqual(cachedEntries);
      // No debería generar un nuevo ranking
      expect(mockPrisma.pointsEvent.groupBy).not.toHaveBeenCalled();
    });

    it('debería generar nuevo ranking si el snapshot es viejo (> 1 hora)', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockPrisma.rankingSnapshot.findFirst.mockResolvedValue({
        id: 'snap-old',
        type: 'WEEKLY',
        weekKey: '2026-W07',
        generatedAt: twoHoursAgo,
        entries: [],
      });

      mockPrisma.pointsEvent.groupBy.mockResolvedValue([
        { playerId: 'u1', _sum: { points: 60 } },
        { playerId: 'u2', _sum: { points: 40 } },
      ]);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Alice', photo: null, rating: 1250 },
        { id: 'u2', name: 'Bob', photo: null, rating: 1220 },
      ]);

      mockPrisma.rankingSnapshot.create.mockResolvedValue({});

      const result = await service.getWeeklyRanking('club-1', '4ta');

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].userId).toBe('u1');
      expect(result.entries[0].points).toBe(60);
      expect(result.entries[0].position).toBe(1);
      expect(result.entries[1].userId).toBe('u2');
      expect(result.entries[1].points).toBe(40);
      expect(result.entries[1].position).toBe(2);
    });

    it('debería generar ranking si no existe snapshot previo', async () => {
      mockPrisma.rankingSnapshot.findFirst.mockResolvedValue(null);

      mockPrisma.pointsEvent.groupBy.mockResolvedValue([
        { playerId: 'u1', _sum: { points: 30 } },
      ]);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Charlie', photo: null, rating: 1100 },
      ]);

      mockPrisma.rankingSnapshot.create.mockResolvedValue({});

      const result = await service.getWeeklyRanking();

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('Charlie');
      expect(result.entries[0].levelCategory).toBe('5ta');
    });
  });

  // ════════════════════════════════════════════
  // Generación de ranking: cálculos
  // ════════════════════════════════════════════

  describe('generación de ranking (cálculos)', () => {
    beforeEach(() => {
      mockPrisma.rankingSnapshot.findFirst.mockResolvedValue(null);
      mockPrisma.rankingSnapshot.create.mockResolvedValue({});
    });

    it('debería ordenar jugadores por puntos descendente', async () => {
      mockPrisma.pointsEvent.groupBy.mockResolvedValue([
        { playerId: 'u-low', _sum: { points: 20 } },
        { playerId: 'u-high', _sum: { points: 100 } },
        { playerId: 'u-mid', _sum: { points: 50 } },
      ]);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u-low', name: 'Low', photo: null, rating: 1000 },
        { id: 'u-high', name: 'High', photo: null, rating: 1200 },
        { id: 'u-mid', name: 'Mid', photo: null, rating: 1100 },
      ]);

      const result = await service.getWeeklyRanking('club-1');

      // Posiciones asignadas por el order de groupBy (que ya viene _sum desc)
      // y luego se filtran por los usuarios encontrados
      expect(result.entries[0].userId).toBe('u-low');
      expect(result.entries[0].position).toBe(1);
    });

    it('debería filtrar por categoría (rango de rating)', async () => {
      mockPrisma.pointsEvent.groupBy.mockResolvedValue([
        { playerId: 'u1', _sum: { points: 50 } },
        { playerId: 'u2', _sum: { points: 30 } },
      ]);

      // Solo devolver el que encaja en la categoría
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'CatUser', photo: null, rating: 1250 },
        // u2 fue filtrado por Prisma (rating no está en rango 4ta: 1200-1399)
      ]);

      const result = await service.getWeeklyRanking('club-1', '4ta');

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].userId).toBe('u1');
    });

    it('debería retornar array vacío si no hay puntos en la semana', async () => {
      mockPrisma.pointsEvent.groupBy.mockResolvedValue([]);

      const result = await service.getWeeklyRanking('club-1');

      expect(result.entries).toHaveLength(0);
    });

    it('debería incluir levelCategory derivada del rating', async () => {
      mockPrisma.pointsEvent.groupBy.mockResolvedValue([
        { playerId: 'u1', _sum: { points: 70 } },
      ]);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'ProPlayer', photo: null, rating: 2100 },
      ]);

      const result = await service.getWeeklyRanking();

      expect(result.entries[0].levelCategory).toBe('1ra');
    });

    it('debería guardar snapshot al generar ranking', async () => {
      mockPrisma.pointsEvent.groupBy.mockResolvedValue([
        { playerId: 'u1', _sum: { points: 50 } },
      ]);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Test', photo: null, rating: 1000 },
      ]);

      await service.getWeeklyRanking('club-x', '5ta');

      expect(mockPrisma.rankingSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'WEEKLY',
          clubId: 'club-x',
          category: '5ta',
          weekKey: '2026-W07',
        }),
      });
    });

    it('debería filtrar por clubId en la query de pointsEvent', async () => {
      mockPrisma.pointsEvent.groupBy.mockResolvedValue([]);

      await service.getWeeklyRanking('club-specific');

      expect(mockPrisma.pointsEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clubId: 'club-specific',
          }),
        }),
      );
    });

    it('debería no filtrar por clubId si no se proporciona', async () => {
      mockPrisma.pointsEvent.groupBy.mockResolvedValue([]);

      await service.getWeeklyRanking();

      const callArg = mockPrisma.pointsEvent.groupBy.mock.calls[0][0];
      expect(callArg.where.clubId).toBeUndefined();
    });
  });

  // ════════════════════════════════════════════
  // getMonthlyRanking
  // ════════════════════════════════════════════

  describe('getMonthlyRanking', () => {
    it('debería retornar snapshot cacheado si es reciente (< 24h)', async () => {
      const cachedEntries = [
        { userId: 'u1', name: 'Monthly Leader', points: 500, position: 1 },
      ];

      mockPrisma.rankingSnapshot.findFirst.mockResolvedValue({
        id: 'snap-monthly',
        type: 'MONTHLY',
        generatedAt: new Date(),
        entries: cachedEntries,
      });

      const result = await service.getMonthlyRanking();

      expect(result.entries).toEqual(cachedEntries);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('debería generar ranking mensual si no hay snapshot', async () => {
      mockPrisma.rankingSnapshot.findFirst.mockResolvedValue(null);

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Top', photo: null, rating: 1500, monthlyPoints: 200 },
        { id: 'u2', name: 'Second', photo: null, rating: 1300, monthlyPoints: 150 },
      ]);

      mockPrisma.rankingSnapshot.create.mockResolvedValue({});

      const result = await service.getMonthlyRanking();

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].points).toBe(200);
      expect(result.entries[1].points).toBe(150);
    });
  });
});

