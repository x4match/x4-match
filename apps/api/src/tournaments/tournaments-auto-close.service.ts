import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TournamentsService } from './tournaments.service';

@Injectable()
export class TournamentsAutoCloseService {
  private readonly logger = new Logger(TournamentsAutoCloseService.name);

  constructor(private readonly tournamentsService: TournamentsService) {}

  @Cron('*/15 * * * *')
  async handlePastTournaments() {
    try {
      const count = await this.tournamentsService.closePastTournaments(true);
      if (count > 0) {
        this.logger.log(`Torneos cerrados por fecha vencida: ${count}`);
      }
    } catch (error) {
      this.logger.error('No se pudieron cerrar los torneos vencidos', error as Error);
    }
  }
}
