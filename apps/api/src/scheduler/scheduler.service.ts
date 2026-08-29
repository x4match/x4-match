import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getWeekKey, getWeekStart } from '../common/utils';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Cierre semanal: todos los lunes a las 00:05 AM
   * - Determina ganadores semanales por club
   * - Notifica a los ganadores
   * - Resetea weeklyPoints de todos los usuarios
   * - Genera snapshots finales del ranking semanal
   */
  @Cron('5 0 * * 1') // Lunes 00:05
  async handleWeeklyReset() {
    this.logger.log('🔄 Ejecutando reset semanal...');

    try {
      // Semana anterior
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 1); // Domingo
      const lastWeekKey = getWeekKey(lastWeek);

      // 1. Obtener ganadores por club
      const clubs = await this.prisma.club.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      for (const club of clubs) {
        const topPlayers = await this.prisma.pointsEvent.groupBy({
          by: ['playerId'],
          where: {
            clubId: club.id,
            weekKey: lastWeekKey,
          },
          _sum: { points: true },
          orderBy: { _sum: { points: 'desc' } },
          take: 1,
        });

        if (topPlayers.length > 0 && topPlayers[0]._sum.points && topPlayers[0]._sum.points > 0) {
          const winnerId = topPlayers[0].playerId;
          // Notificar al ganador
          await this.notifications.notifyWeeklyWinner(
            winnerId,
            club.name,
            lastWeekKey,
          );
          this.logger.log(`🏆 Ganador semanal de ${club.name}: ${winnerId}`);
        }
      }

      // 2. Resetear weeklyPoints de todos los usuarios
      await this.prisma.user.updateMany({
        data: { weeklyPoints: 0 },
      });

      this.logger.log('✅ Reset semanal completado');
    } catch (error) {
      this.logger.error('❌ Error en reset semanal:', error);
    }
  }

  /**
   * Acumulación mensual: 1° de cada mes a las 00:10 AM
   * - Resetea monthlyPoints
   */
  @Cron('10 0 1 * *') // Día 1 de cada mes 00:10
  async handleMonthlyReset() {
    this.logger.log('🔄 Ejecutando reset mensual...');

    try {
      await this.prisma.user.updateMany({
        data: { monthlyPoints: 0 },
      });

      this.logger.log('✅ Reset mensual completado');
    } catch (error) {
      this.logger.error('❌ Error en reset mensual:', error);
    }
  }

  /**
   * Expirar match requests pendientes (cada hora)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpireMatchRequests() {
    const now = new Date();
    const expired = await this.prisma.matchRequest.updateMany({
      where: {
        status: 'PENDING',
        date: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    if (expired.count > 0) {
      this.logger.log(`⏰ ${expired.count} match requests expirados`);
    }
  }
}

