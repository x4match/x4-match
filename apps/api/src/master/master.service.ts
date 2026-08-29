import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MasterService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Obtener temporada activa con sus eventos.
   */
  async getCurrentSeason() {
    const season = await this.prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        masterEvents: {
          include: {
            participants: {
              include: {
                user1: { select: { id: true, name: true, photo: true, rating: true } },
                user2: { select: { id: true, name: true, photo: true, rating: true } },
              },
            },
            masterMatches: {
              include: {
                teamA: {
                  include: {
                    user1: { select: { id: true, name: true, photo: true } },
                    user2: { select: { id: true, name: true, photo: true } },
                  },
                },
                teamB: {
                  include: {
                    user1: { select: { id: true, name: true, photo: true } },
                    user2: { select: { id: true, name: true, photo: true } },
                  },
                },
              },
              orderBy: [{ round: 'desc' }, { position: 'asc' }],
            },
          },
          orderBy: { eventDate: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return season;
  }

  /**
   * Obtener un evento específico con bracket completo.
   */
  async getEvent(eventId: string) {
    const event = await this.prisma.masterEvent.findUnique({
      where: { id: eventId },
      include: {
        season: true,
        participants: {
          include: {
            user1: { select: { id: true, name: true, photo: true, rating: true } },
            user2: { select: { id: true, name: true, photo: true, rating: true } },
          },
          orderBy: { seed: 'asc' },
        },
        masterMatches: {
          include: {
            teamA: {
              include: {
                user1: { select: { id: true, name: true, photo: true } },
                user2: { select: { id: true, name: true, photo: true } },
              },
            },
            teamB: {
              include: {
                user1: { select: { id: true, name: true, photo: true } },
                user2: { select: { id: true, name: true, photo: true } },
              },
            },
          },
          orderBy: [{ round: 'desc' }, { position: 'asc' }],
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    return event;
  }

  /**
   * Listar todas las temporadas.
   */
  async getSeasons() {
    return this.prisma.season.findMany({
      include: {
        _count: { select: { masterEvents: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Crear una temporada.
   */
  async createSeason(data: {
    name: string;
    startDate: Date;
    endDate: Date;
  }) {
    return this.prisma.season.create({ data });
  }

  /**
   * Crear un evento dentro de una temporada.
   */
  async createEvent(seasonId: string, data: {
    name: string;
    eventDate?: Date;
  }) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException('Temporada no encontrada');

    return this.prisma.masterEvent.create({
      data: {
        seasonId,
        name: data.name,
        eventDate: data.eventDate,
        status: 'REGISTRATION',
      },
    });
  }

  /**
   * Inscribir una pareja al evento Master.
   */
  async registerForMaster(eventId: string, userId1: string, userId2: string) {
    if (userId1 === userId2) {
      throw new BadRequestException('No puedes inscribirte con vos mismo');
    }

    const event = await this.prisma.masterEvent.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });

    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.status !== 'REGISTRATION') {
      throw new BadRequestException('La inscripción no está abierta');
    }

    // Verificar que ninguno ya esté inscrito
    const alreadyRegistered = event.participants.find(
      (p) => p.userId1 === userId1 || p.userId2 === userId1 ||
             p.userId1 === userId2 || p.userId2 === userId2,
    );

    if (alreadyRegistered) {
      throw new BadRequestException('Uno de los jugadores ya está inscrito en este evento');
    }

    const participant = await this.prisma.masterParticipant.create({
      data: {
        masterEventId: eventId,
        userId1,
        userId2,
      },
      include: {
        user1: { select: { id: true, name: true, photo: true } },
        user2: { select: { id: true, name: true, photo: true } },
      },
    });

    // Notificar al compañero
    await this.notifications.create({
      userId: userId2,
      type: 'MASTER_REGISTRATION',
      title: '🏆 Inscripción al Máster',
      body: `Te inscribieron al torneo: ${event.name}`,
      data: { eventId },
    });

    return participant;
  }

  /**
   * Generar el bracket del torneo (eliminación directa).
   */
  async generateBracket(eventId: string) {
    const event = await this.prisma.masterEvent.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            user1: { select: { rating: true } },
            user2: { select: { rating: true } },
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.status !== 'REGISTRATION') {
      throw new BadRequestException('El bracket ya fue generado o el evento no está en inscripción');
    }

    const participants = event.participants;
    if (participants.length < 2) {
      throw new BadRequestException('Se necesitan al menos 2 parejas para generar el bracket');
    }

    // Ordenar por seed (o por rating promedio de la pareja)
    const sorted = [...participants].sort((a, b) => {
      if (a.seed && b.seed) return a.seed - b.seed;
      const avgA = (a.user1.rating + a.user2.rating) / 2;
      const avgB = (b.user1.rating + b.user2.rating) / 2;
      return avgB - avgA; // Mayor rating primero
    });

    // Asignar seeds
    for (let i = 0; i < sorted.length; i++) {
      await this.prisma.masterParticipant.update({
        where: { id: sorted[i].id },
        data: { seed: i + 1 },
      });
    }

    // Calcular rondas: encontrar la potencia de 2 más cercana
    const totalSlots = Math.pow(2, Math.ceil(Math.log2(sorted.length)));
    const totalRounds = Math.log2(totalSlots);

    // Crear partidos de primera ronda
    const firstRoundMatches = totalSlots / 2;
    const matches: any[] = [];

    for (let i = 0; i < firstRoundMatches; i++) {
      const teamAIndex = i;
      const teamBIndex = totalSlots - 1 - i;

      const teamA = sorted[teamAIndex] || null;
      const teamB = teamBIndex < sorted.length ? sorted[teamBIndex] : null;

      matches.push({
        masterEventId: eventId,
        round: totalSlots, // Primera ronda tiene el valor más alto
        position: i + 1,
        teamAId: teamA?.id || null,
        teamBId: teamB?.id || null,
        status: (!teamA || !teamB) ? 'COMPLETED' : 'PENDING',
        // Si solo hay un equipo, gana por BYE
        winnerId: (!teamA && teamB) ? teamB.id :
                  (teamA && !teamB) ? teamA.id : null,
      });
    }

    // Crear partidos de rondas posteriores (vacíos)
    let roundSize = firstRoundMatches / 2;
    let round = totalSlots / 2;
    while (round >= 1) {
      for (let i = 0; i < roundSize; i++) {
        matches.push({
          masterEventId: eventId,
          round,
          position: i + 1,
          teamAId: null,
          teamBId: null,
          status: 'PENDING',
        });
      }
      roundSize = roundSize / 2;
      round = round / 2;
    }

    // Insertar todos los partidos
    await this.prisma.masterMatch.createMany({ data: matches });

    // Avanzar los BYEs a la siguiente ronda
    await this.advanceByes(eventId, totalSlots);

    // Actualizar estado del evento
    await this.prisma.masterEvent.update({
      where: { id: eventId },
      data: { status: 'IN_PROGRESS' },
    });

    // Notificar a todos los participantes
    const notifs = participants.flatMap((p) => [
      {
        userId: p.userId1,
        type: 'MASTER_UPDATE' as const,
        title: '🏆 ¡El torneo comenzó!',
        body: `El bracket de ${event.name} fue generado. ¡Mirá tu primer rival!`,
        data: { eventId },
      },
      {
        userId: p.userId2,
        type: 'MASTER_UPDATE' as const,
        title: '🏆 ¡El torneo comenzó!',
        body: `El bracket de ${event.name} fue generado. ¡Mirá tu primer rival!`,
        data: { eventId },
      },
    ]);
    await this.notifications.createMany(notifs);

    return this.getEvent(eventId);
  }

  /**
   * Cargar resultado de un partido del torneo.
   */
  async submitMatchResult(matchId: string, teamAScore: number, teamBScore: number) {
    const match = await this.prisma.masterMatch.findUnique({
      where: { id: matchId },
      include: { masterEvent: true },
    });

    if (!match) throw new NotFoundException('Partido no encontrado');
    if (match.status === 'COMPLETED') {
      throw new BadRequestException('Este partido ya tiene resultado');
    }
    if (!match.teamAId || !match.teamBId) {
      throw new BadRequestException('El partido no tiene ambos equipos asignados');
    }
    if (teamAScore === teamBScore) {
      throw new BadRequestException('No puede haber empate en un torneo');
    }

    const winnerId = teamAScore > teamBScore ? match.teamAId : match.teamBId;

    // Actualizar el partido
    await this.prisma.masterMatch.update({
      where: { id: matchId },
      data: {
        teamAScore,
        teamBScore,
        winnerId,
        status: 'COMPLETED',
      },
    });

    // Marcar al perdedor como eliminado
    const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
    await this.prisma.masterParticipant.update({
      where: { id: loserId },
      data: { eliminated: true },
    });

    // Avanzar al ganador a la siguiente ronda
    await this.advanceWinner(match.masterEventId, match.round, match.position, winnerId);

    // Verificar si el torneo terminó (round === 1 es la final)
    if (match.round === 1) {
      await this.prisma.masterEvent.update({
        where: { id: match.masterEventId },
        data: { status: 'COMPLETED' },
      });
    }

    return this.getEvent(match.masterEventId);
  }

  /**
   * Avanza al ganador a la siguiente ronda.
   */
  private async advanceWinner(eventId: string, currentRound: number, currentPosition: number, winnerId: string) {
    if (currentRound <= 1) return; // Ya es la final

    const nextRound = currentRound / 2;
    const nextPosition = Math.ceil(currentPosition / 2);

    const nextMatch = await this.prisma.masterMatch.findFirst({
      where: {
        masterEventId: eventId,
        round: nextRound,
        position: nextPosition,
      },
    });

    if (!nextMatch) return;

    // Determinar si va como teamA o teamB
    const isTeamA = currentPosition % 2 === 1; // Posiciones impares -> teamA

    await this.prisma.masterMatch.update({
      where: { id: nextMatch.id },
      data: isTeamA ? { teamAId: winnerId } : { teamBId: winnerId },
    });
  }

  /**
   * Avanza los BYEs automáticamente.
   */
  private async advanceByes(eventId: string, firstRound: number) {
    const byeMatches = await this.prisma.masterMatch.findMany({
      where: {
        masterEventId: eventId,
        round: firstRound,
        status: 'COMPLETED',
        winnerId: { not: null },
      },
    });

    for (const match of byeMatches) {
      await this.advanceWinner(eventId, match.round, match.position, match.winnerId!);
    }
  }

  /**
   * Obtener el estado del usuario en el torneo actual.
   */
  async getMyTournamentStatus(userId: string) {
    const season = await this.prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        masterEvents: {
          include: {
            participants: {
              where: {
                OR: [{ userId1: userId }, { userId2: userId }],
              },
              include: {
                user1: { select: { id: true, name: true, photo: true, rating: true } },
                user2: { select: { id: true, name: true, photo: true, rating: true } },
              },
            },
          },
        },
      },
    });

    if (!season) return { registered: false, season: null };

    const registrations = season.masterEvents
      .filter((e) => e.participants.length > 0)
      .map((e) => ({
        eventId: e.id,
        eventName: e.name,
        eventDate: e.eventDate,
        status: e.status,
        participant: e.participants[0],
      }));

    return {
      registered: registrations.length > 0,
      season: {
        id: season.id,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
      },
      registrations,
    };
  }
}
