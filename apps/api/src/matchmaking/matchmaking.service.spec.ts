import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';

// ─── Helpers para crear datos de test ───

const makeUser = (overrides: Partial<{ id: string; name: string; rating: number; photo: string }> = {}) => ({
  id: overrides.id ?? 'user-1',
  name: overrides.name ?? 'Test User',
  rating: overrides.rating ?? 1200,
  photo: overrides.photo ?? null,
});

const makeMatchRequest = (overrides: Record<string, any> = {}) => ({
  id: 'mr-1',
  userId: 'user-1',
  clubId: 'club-1',
  date: new Date('2026-02-11T10:00:00'),
  startHour: 10,
  endHour: 12,
  minRating: null,
  maxRating: null,
  category: null,
  status: 'PENDING',
  createdAt: new Date(),
  user: makeUser({ id: 'user-1', rating: 1250 }),
  ...overrides,
});

// ─── Mocks ───

const mockPrisma = {
  matchRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  match: {
    create: jest.fn(),
  },
  clubPromotion: {
    findFirst: jest.fn(),
  },
};

const mockAvailabilityService = {
  findAvailableUsers: jest.fn(),
};

describe('MatchmakingService', () => {
  let service: MatchmakingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
      ],
    }).compile();

    service = module.get<MatchmakingService>(MatchmakingService);
  });

  // ════════════════════════════════════════════
  // createMatchRequest
  // ════════════════════════════════════════════

  describe('createMatchRequest', () => {
    it('debería crear un match request correctamente', async () => {
      const data = {
        clubId: 'club-1',
        date: new Date('2026-02-15'),
        startHour: 19,
        endHour: 21,
        minRating: 1100,
        maxRating: 1300,
      };

      mockPrisma.matchRequest.create.mockResolvedValue({
        id: 'mr-new',
        userId: 'user-1',
        ...data,
        status: 'PENDING',
      });

      const result = await service.createMatchRequest('user-1', data);
      expect(result.id).toBe('mr-new');
      expect(mockPrisma.matchRequest.create).toHaveBeenCalledTimes(1);
    });
  });

  // ════════════════════════════════════════════
  // runMatchmaking
  // ════════════════════════════════════════════

  describe('runMatchmaking', () => {
    it('debería lanzar NotFoundException si el matchRequest no existe', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(null);

      await expect(service.runMatchmaking('bad-id', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si el usuario no es el creador', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(makeMatchRequest());

      await expect(service.runMatchmaking('mr-1', 'other-user'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si el matchRequest ya fue procesado', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(
        makeMatchRequest({ status: 'MATCHED' }),
      );

      await expect(service.runMatchmaking('mr-1', 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si no hay suficientes jugadores (< 3)', async () => {
      mockPrisma.matchRequest.findUnique.mockResolvedValue(makeMatchRequest());
      mockAvailabilityService.findAvailableUsers.mockResolvedValue([
        makeUser({ id: 'u2', rating: 1240 }),
        makeUser({ id: 'u3', rating: 1260 }),
        // Solo 2, necesita 3
      ]);

      await expect(service.runMatchmaking('mr-1', 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería crear un match PROPOSED con 4 participantes cuando hay suficientes jugadores', async () => {
      const matchRequest = makeMatchRequest();
      mockPrisma.matchRequest.findUnique.mockResolvedValue(matchRequest);

      const candidates = [
        makeUser({ id: 'u2', rating: 1240 }),
        makeUser({ id: 'u3', rating: 1260 }),
        makeUser({ id: 'u4', rating: 1220 }),
        makeUser({ id: 'u5', rating: 1100 }),
      ];
      mockAvailabilityService.findAvailableUsers.mockResolvedValue(candidates);

      mockPrisma.clubPromotion.findFirst.mockResolvedValue(null);

      const createdMatch = {
        id: 'match-1',
        status: 'PROPOSED',
        clubId: 'club-1',
        date: matchRequest.date,
        startHour: 10,
        endHour: 12,
        bonusPointsApplied: 10,
        participants: [
          { id: 'p1', userId: 'user-1', team: 'A', isCaptain: true, status: 'ACCEPTED', user: makeUser({ id: 'user-1', rating: 1250 }) },
          { id: 'p2', userId: 'u4', team: 'A', isCaptain: false, status: 'INVITED', user: makeUser({ id: 'u4', rating: 1220 }) },
          { id: 'p3', userId: 'u2', team: 'B', isCaptain: false, status: 'INVITED', user: makeUser({ id: 'u2', rating: 1240 }) },
          { id: 'p4', userId: 'u3', team: 'B', isCaptain: false, status: 'INVITED', user: makeUser({ id: 'u3', rating: 1260 }) },
        ],
        club: { id: 'club-1', name: 'Padel Center', address: 'Av. Test 123' },
      };
      mockPrisma.match.create.mockResolvedValue(createdMatch);
      mockPrisma.matchRequest.update.mockResolvedValue({});

      const result = await service.runMatchmaking('mr-1', 'user-1');

      // Verifica que se creó el match con status PROPOSED
      expect(mockPrisma.match.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrisma.match.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('PROPOSED');

      // Verifica que tiene 4 participantes
      expect(createCall.data.participants.create).toHaveLength(4);

      // Verifica que el creador tiene status ACCEPTED
      const creatorParticipant = createCall.data.participants.create.find(
        (p: any) => p.userId === 'user-1',
      );
      expect(creatorParticipant.status).toBe('ACCEPTED');
      expect(creatorParticipant.isCaptain).toBe(true);

      // Verifica que los otros tienen status INVITED
      const invitedParticipants = createCall.data.participants.create.filter(
        (p: any) => p.userId !== 'user-1',
      );
      expect(invitedParticipants).toHaveLength(3);
      invitedParticipants.forEach((p: any) => {
        expect(p.status).toBe('INVITED');
      });

      // Verifica que el matchRequest se marcó como MATCHED
      expect(mockPrisma.matchRequest.update).toHaveBeenCalledWith({
        where: { id: 'mr-1' },
        data: { status: 'MATCHED' },
      });

      // Verifica que el resultado incluye levelCategory
      expect(result.participants[0].user.levelCategory).toBeDefined();
    });

    it('debería seleccionar jugadores por cercanía de rating al creador', async () => {
      const matchRequest = makeMatchRequest({ clubId: null });
      mockPrisma.matchRequest.findUnique.mockResolvedValue(matchRequest);

      // Creador tiene rating 1250
      const candidates = [
        makeUser({ id: 'u-far', rating: 900 }),    // |900-1250| = 350
        makeUser({ id: 'u-close1', rating: 1240 }), // |1240-1250| = 10
        makeUser({ id: 'u-close2', rating: 1260 }), // |1260-1250| = 10
        makeUser({ id: 'u-close3', rating: 1230 }), // |1230-1250| = 20
        makeUser({ id: 'u-mid', rating: 1100 }),    // |1100-1250| = 150
      ];
      mockAvailabilityService.findAvailableUsers.mockResolvedValue(candidates);

      const createdMatch = {
        id: 'match-2',
        status: 'PROPOSED',
        participants: [],
        club: null,
        bonusPointsApplied: 0,
      };
      mockPrisma.match.create.mockResolvedValue(createdMatch);
      mockPrisma.matchRequest.update.mockResolvedValue({});

      await service.runMatchmaking('mr-1', 'user-1');

      const createCall = mockPrisma.match.create.mock.calls[0][0];
      const participantUserIds = createCall.data.participants.create.map(
        (p: any) => p.userId,
      );

      // Los 3 más cercanos (u-close1 Δ10, u-close2 Δ10, u-close3 Δ20)
      expect(participantUserIds).toContain('u-close1');
      expect(participantUserIds).toContain('u-close2');
      expect(participantUserIds).toContain('u-close3');
      // No debería incluir a u-far ni u-mid (son los más lejanos)
      expect(participantUserIds).not.toContain('u-far');
    });

    it('debería aplicar bonus de horario valle (10-16h) cuando no hay promoción', async () => {
      const matchRequest = makeMatchRequest({ startHour: 11 }); // Dentro del rango valle
      mockPrisma.matchRequest.findUnique.mockResolvedValue(matchRequest);

      mockAvailabilityService.findAvailableUsers.mockResolvedValue([
        makeUser({ id: 'u2' }), makeUser({ id: 'u3' }), makeUser({ id: 'u4' }),
      ]);
      mockPrisma.clubPromotion.findFirst.mockResolvedValue(null); // Sin promoción

      mockPrisma.match.create.mockResolvedValue({
        id: 'match-3',
        status: 'PROPOSED',
        participants: [],
        club: null,
      });
      mockPrisma.matchRequest.update.mockResolvedValue({});

      await service.runMatchmaking('mr-1', 'user-1');

      const createCall = mockPrisma.match.create.mock.calls[0][0];
      expect(createCall.data.bonusPointsApplied).toBe(10);
    });

    it('debería aplicar bonus de promoción del club si existe', async () => {
      const matchRequest = makeMatchRequest({ startHour: 14 });
      mockPrisma.matchRequest.findUnique.mockResolvedValue(matchRequest);

      mockAvailabilityService.findAvailableUsers.mockResolvedValue([
        makeUser({ id: 'u2' }), makeUser({ id: 'u3' }), makeUser({ id: 'u4' }),
      ]);

      // Hay una promoción activa
      mockPrisma.clubPromotion.findFirst.mockResolvedValue({
        id: 'promo-1',
        bonusPoints: 25,
        active: true,
      });

      mockPrisma.match.create.mockResolvedValue({
        id: 'match-4',
        status: 'PROPOSED',
        participants: [],
        club: null,
      });
      mockPrisma.matchRequest.update.mockResolvedValue({});

      await service.runMatchmaking('mr-1', 'user-1');

      const createCall = mockPrisma.match.create.mock.calls[0][0];
      expect(createCall.data.bonusPointsApplied).toBe(25);
    });

    it('debería no aplicar bonus si no hay club', async () => {
      const matchRequest = makeMatchRequest({ clubId: null, startHour: 11 });
      mockPrisma.matchRequest.findUnique.mockResolvedValue(matchRequest);

      mockAvailabilityService.findAvailableUsers.mockResolvedValue([
        makeUser({ id: 'u2' }), makeUser({ id: 'u3' }), makeUser({ id: 'u4' }),
      ]);

      mockPrisma.match.create.mockResolvedValue({
        id: 'match-5',
        status: 'PROPOSED',
        participants: [],
        club: null,
      });
      mockPrisma.matchRequest.update.mockResolvedValue({});

      await service.runMatchmaking('mr-1', 'user-1');

      const createCall = mockPrisma.match.create.mock.calls[0][0];
      expect(createCall.data.bonusPointsApplied).toBe(0);
    });

    it('debería asignar equipos A y B correctamente (2 por equipo)', async () => {
      const matchRequest = makeMatchRequest({ clubId: null });
      mockPrisma.matchRequest.findUnique.mockResolvedValue(matchRequest);

      mockAvailabilityService.findAvailableUsers.mockResolvedValue([
        makeUser({ id: 'u2', rating: 1240 }),
        makeUser({ id: 'u3', rating: 1260 }),
        makeUser({ id: 'u4', rating: 1230 }),
      ]);

      mockPrisma.match.create.mockResolvedValue({
        id: 'match-6',
        status: 'PROPOSED',
        participants: [],
        club: null,
      });
      mockPrisma.matchRequest.update.mockResolvedValue({});

      await service.runMatchmaking('mr-1', 'user-1');

      const createCall = mockPrisma.match.create.mock.calls[0][0];
      const participants = createCall.data.participants.create;

      const teamA = participants.filter((p: any) => p.team === 'A');
      const teamB = participants.filter((p: any) => p.team === 'B');

      expect(teamA).toHaveLength(2);
      expect(teamB).toHaveLength(2);
    });
  });

  // ════════════════════════════════════════════
  // getMyMatchRequests
  // ════════════════════════════════════════════

  describe('getMyMatchRequests', () => {
    it('debería retornar los match requests del usuario', async () => {
      const requests = [
        makeMatchRequest({ id: 'mr-1', status: 'PENDING' }),
        makeMatchRequest({ id: 'mr-2', status: 'MATCHED' }),
      ];
      mockPrisma.matchRequest.findMany.mockResolvedValue(requests);

      const result = await service.getMyMatchRequests('user-1');
      expect(result).toHaveLength(2);
      expect(mockPrisma.matchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});

