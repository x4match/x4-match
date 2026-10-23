import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDuePushes() {
    try {
      const sent = await this.notifications.sendDuePushes();
      if (sent > 0) this.logger.log(`Push diferidos enviados: ${sent}`);
    } catch (error) {
      this.logger.warn(`No se pudieron enviar push diferidos: ${(error as Error).message}`);
    }
  }
}
