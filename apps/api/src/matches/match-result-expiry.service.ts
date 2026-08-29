import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchesService } from './matches.service';

@Injectable()
export class MatchResultExpiryService {
  private readonly logger = new Logger(MatchResultExpiryService.name);

  constructor(private readonly matchesService: MatchesService) {}

  @Cron('*/15 * * * *')
  async handleExpiredCourtWindows() {
    const count = await this.matchesService.expirePastCourtWindowMatches();
    if (count > 0) {
      this.logger.log(`Partidos cancelados por horario de cancha vencido: ${count}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredResults() {
    const count = await this.matchesService.processExpiredPendingResults();
    if (count > 0) {
      this.logger.log(`Partidos cerrados sin acuerdo (48h, sin puntos): ${count}`);
    }
  }
}
