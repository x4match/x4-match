import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClubGapFillService } from './club-gap-fill.service';

@Injectable()
export class ClubGapFillCron {
  private readonly logger = new Logger(ClubGapFillCron.name);

  constructor(private readonly gapFillService: ClubGapFillService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyGapFill() {
    const result = await this.gapFillService.runForEnabledClubs();
    if (result.notified > 0 || result.clubs > 0) {
      this.logger.log(
        `Gap-fill: ${result.clubs} clubs, ${result.notified} notificaciones enviadas`,
      );
    }
  }
}
