import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  imports: [RealtimeModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
