import { Module } from '@nestjs/common';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';
import { AvailabilityModule } from '../availability/availability.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [AvailabilityModule, MatchesModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}

