import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

// ─── Helpers ───

const makeParticipant = (overrides: Record<string, any> = {}) => ({
  id: 'part-1',
  userId: 'u1',
  team: 'A',
  isCaptain: false,
  status: 'INVITED',
  confirmedAt: null,
  user: { id: 'u1', name: 'Test', photo: null, rating: 1200 },
  ...overrides,
});

const makeMatch = (overrides: Record<string, any> = {}) => ({
  id: 'match-1',
  status: 'PROPOSED',
  clubId: 'club-1',
  date: new Date('2026-02-15'),
  startHour: 19,
  endHour: 21,
  bonusPointsApplied: 0,
  participants: [
    makeParticipant({ id: 'p1', userId: 'creator', status: 'ACCEPTED', isCaptain: true }),
    makeParticipant({ id: 'p2', userId: 'u2', status: 'INVITED' }),
    makeParticipant({ id: 'p3', userId: 'u3', status: 'INVITED', team: 'B' }),
    makeParticipant({ id: 'p4', userId: 'u4', status: 'INVITED', team: 'B' }),
  ],
  club: { id: 'club-1', name: 'Test Club', address: 'Test St', zone: 'Norte' },
  result: null,
  ...overrides,
});

// ─── Mocks ───

const mockPrisma = {
  match: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  matchParticipant: {
    update: jest.fn(),
  },
  matchResult: {
    create: jest.fn(),
  },
  pointsEvent: {
    create: jest.fn(),
  },
  weeklyPoints: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

const mockUsersService = {
  updateRating: jest.fn(),
  addWeeklyPoints: jest.fn(),
};

describe('MatchesService', () => {
  let service: MatchesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  // ════════════════════════════════════════════
  // acceptMatch
  // ════════════════════════════════════════════

  describe('acceptMatch', () => {
    it('debería lanzar NotFoundException si el match no existe', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);

      await expect(service.acceptMatch('bad-id', 'u1'))
        .rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si el match no es PROPOSED ni PENDING', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch({ status: 'CONFIRMED' }));

      await expect(service.acceptMatch('match-1', 'u2'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si el usuario no es participante', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch());

      await expect(service.acceptMatch('match-1', 'outsider'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si el participante ya aceptó', async () => {
      const match = makeMatch({
        participants: [
          makeParticipant({ id: 'p1', userId: 'u2', status: 'ACCEPTED' }),
        ],
      });
      mockPrisma.match.findUnique.mockResolvedValue(match);

      await expect(service.acceptMatch('match-1', 'u2'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si el participante ya rechazó', async () => {
      const match = makeMatch({
        participants: [
          makeParticipant({ id: 'p1', userId: 'u2', status: 'DECLINED' }),
        ],
      });
      mockPrisma.match.findUnique.mockResolvedValue(match);

      await expect(service.acceptMatch('match-1', 'u2'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería actualizar el participante a ACCEPTED', async () => {
      const match = makeMatch();
      // Primera llamada: findOne para validar
      mockPrisma.match.findUnique.mockResolvedValueOnce(match);
      // Segunda llamada: findOne para verificar si todos aceptaron
      mockPrisma.match.findUnique.mockResolvedValueOnce({
        ...match,
        participants: match.participants.map((p) =>
          p.userId === 'u2' ? { ...p, status: 'ACCEPTED' } : p,
        ),
      });

      mockPrisma.matchParticipant.update.mockResolvedValue({});

      await service.acceptMatch('match-1', 'u2');

      expect(mockPrisma.matchParticipant.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: {
          status: 'ACCEPTED',
          confirmedAt: expect.any(Date),
        },
      });
    });

    it('debería cambiar el match a CONFIRMED si todos aceptaron', async () => {
      const match = makeMatch({
        participants: [
          makeParticipant({ id: 'p1', userId: 'creator', status: 'ACCEPTED' }),
          makeParticipant({ id: 'p2', userId: 'u2', status: 'ACCEPTED' }),
          makeParticipant({ id: 'p3', userId: 'u3', status: 'ACCEPTED' }),
          makeParticipant({ id: 'p4', userId: 'u4', status: 'INVITED' }), // Este acepta ahora
        ],
      });

      // Primera llamada: findOne
      mockPrisma.match.findUnique.mockResolvedValueOnce(match);
      // Segunda llamada: después de update, todos son ACCEPTED
      const allAcceptedMatch = {
        ...match,
        participants: match.participants.map((p) => ({ ...p, status: 'ACCEPTED' })),
      };
      mockPrisma.match.findUnique.mockResolvedValueOnce(allAcceptedMatch);
      // Tercera llamada: findOne al final (después de update status)
      mockPrisma.match.findUnique.mockResolvedValueOnce({ ...allAcceptedMatch, status: 'CONFIRMED' });

      mockPrisma.matchParticipant.update.mockResolvedValue({});
      mockPrisma.match.update.mockResolvedValue({});

      const result = await service.acceptMatch('match-1', 'u4');

      expect(mockPrisma.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { status: 'CONFIRMED' },
      });
    });

    it('no debería cambiar a CONFIRMED si no todos aceptaron', async () => {
      const match = makeMatch();
      // Primera llamada
      mockPrisma.match.findUnique.mockResolvedValueOnce(match);
      // Segunda llamada: u2 aceptó pero u3 y u4 siguen INVITED
      const partialMatch = {
        ...match,
        participants: match.participants.map((p) =>
          p.userId === 'u2' ? { ...p, status: 'ACCEPTED' } : p,
        ),
      };
      mockPrisma.match.findUnique.mockResolvedValueOnce(partialMatch);

      mockPrisma.matchParticipant.update.mockResolvedValue({});

      await service.acceptMatch('match-1', 'u2');

      // No debería haber llamado a match.update (para cambiar a CONFIRMED)
      expect(mockPrisma.match.update).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════
  // declineMatch
  // ════════════════════════════════════════════

  describe('declineMatch', () => {
    it('debería lanzar NotFoundException si el match no existe', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);

      await expect(service.declineMatch('bad-id', 'u1'))
        .rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si el match no es PROPOSED ni PENDING', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch({ status: 'CONFIRMED' }));

      await expect(service.declineMatch('match-1', 'u2'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si el usuario no es participante', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch());

      await expect(service.declineMatch('match-1', 'outsider'))
        .rejects.toThrow(BadRequestException);
    });

    it('debería marcar participante como DECLINED y cancelar el match', async () => {
      const match = makeMatch();
      // Primera llamada para validar
      mockPrisma.match.findUnique.mockResolvedValueOnce(match);
      // Segunda llamada para retornar resultado
      mockPrisma.match.findUnique.mockResolvedValueOnce({
        ...match,
        status: 'CANCELED',
        participants: match.participants.map((p) =>
          p.userId === 'u2' ? { ...p, status: 'DECLINED' } : p,
        ),
      });

      mockPrisma.matchParticipant.update.mockResolvedValue({});
      mockPrisma.match.update.mockResolvedValue({});

      await service.declineMatch('match-1', 'u2');

      // Verifica que el participante fue marcado como DECLINED
      expect(mockPrisma.matchParticipant.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { status: 'DECLINED' },
      });

      // Verifica que el match fue cancelado
      expect(mockPrisma.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { status: 'CANCELED' },
      });
    });

    it('debería lanzar BadRequestException si ya rechazó previamente', async () => {
      const match = makeMatch({
        participants: [
          makeParticipant({ id: 'p2', userId: 'u2', status: 'DECLINED' }),
        ],
      });
      mockPrisma.match.findUnique.mockResolvedValue(match);

      await expect(service.declineMatch('match-1', 'u2'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════
  // submitResult
  // ════════════════════════════════════════════

  describe('submitResult', () => {
    it('debería lanzar BadRequestException si el match no está CONFIRMED', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch({ status: 'PROPOSED' }));

      await expect(
        service.submitResult('match-1', 'creator', { teamAScore: 6, teamBScore: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si ya tiene resultado', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(
        makeMatch({ status: 'CONFIRMED', result: { teamAScore: 6, teamBScore: 4 } }),
      );

      await expect(
        service.submitResult('match-1', 'creator', { teamAScore: 6, teamBScore: 3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException si el usuario no es participante', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(makeMatch({ status: 'CONFIRMED' }));

      await expect(
        service.submitResult('match-1', 'outsider', { teamAScore: 6, teamBScore: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería crear resultado, actualizar ratings y otorgar puntos', async () => {
      const confirmedMatch = makeMatch({
        status: 'CONFIRMED',
        bonusPointsApplied: 10,
        participants: [
          makeParticipant({ id: 'p1', userId: 'creator', status: 'ACCEPTED', team: 'A', user: { id: 'creator', name: 'Creator', photo: null, rating: 1200 } }),
          makeParticipant({ id: 'p2', userId: 'u2', status: 'ACCEPTED', team: 'A', user: { id: 'u2', name: 'U2', photo: null, rating: 1180 } }),
          makeParticipant({ id: 'p3', userId: 'u3', status: 'ACCEPTED', team: 'B', user: { id: 'u3', name: 'U3', photo: null, rating: 1220 } }),
          makeParticipant({ id: 'p4', userId: 'u4', status: 'ACCEPTED', team: 'B', user: { id: 'u4', name: 'U4', photo: null, rating: 1250 } }),
        ],
      });

      // findOne devuelve el match (primera y segunda llamadas)
      mockPrisma.match.findUnique
        .mockResolvedValueOnce(confirmedMatch)
        .mockResolvedValueOnce({ ...confirmedMatch, status: 'COMPLETED' });

      mockPrisma.matchResult.create.mockResolvedValue({});
      mockPrisma.match.update.mockResolvedValue({});
      mockUsersService.updateRating.mockResolvedValue({});
      mockUsersService.addWeeklyPoints.mockResolvedValue({});
      mockPrisma.pointsEvent.create.mockResolvedValue({});
      mockPrisma.weeklyPoints.findUnique.mockResolvedValue(null);
      mockPrisma.weeklyPoints.create.mockResolvedValue({});

      await service.submitResult('match-1', 'creator', { teamAScore: 6, teamBScore: 4 });

      // Verifica que se creó el resultado
      expect(mockPrisma.matchResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchId: 'match-1',
          teamAScore: 6,
          teamBScore: 4,
          submittedBy: 'creator',
        }),
      });

      // Verifica que se marcó como COMPLETED
      expect(mockPrisma.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { status: 'COMPLETED' },
      });

      // Verifica que se actualizaron ratings (4 participantes)
      expect(mockUsersService.updateRating).toHaveBeenCalledTimes(4);

      // Verifica que se crearon puntos (base + bonus para 4 jugadores = 8 PointsEvent)
      // 4 x PLAYED_MATCH + 4 x VALLEY_BONUS (porque bonusPointsApplied > 0)
      expect(mockPrisma.pointsEvent.create).toHaveBeenCalledTimes(8);
    });
  });
});

