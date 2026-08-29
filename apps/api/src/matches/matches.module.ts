import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchesRepository } from './matches.repository';
import { ClubsModule } from '../clubs/clubs.module';
import { CompetitiveScoringModule } from '../competitive-scoring/competitive-scoring.module';
import { BadgesModule } from '../badges/badges.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PaymentsModule } from '../payments/payments.module';
import { MatchResultExpiryService } from './match-result-expiry.service';

@Module({
  imports: [
    ScheduleModule,
    RealtimeModule,
    forwardRef(() => ClubsModule),
    CompetitiveScoringModule,
    BadgesModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesRepository, MatchResultExpiryService],
  exports: [MatchesService, MatchesRepository],
})
export class MatchesModule {}

