import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchesRepository } from './matches.repository';
import { ClubsModule } from '../clubs/clubs.module';
import { CompetitiveScoringModule } from '../competitive-scoring/competitive-scoring.module';
import { BadgesModule } from '../badges/badges.module';
import { ChallengesModule } from '../challenges/challenges.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReportsModule } from '../reports/reports.module';
import { MatchResultExpiryService } from './match-result-expiry.service';
import { MatchReminderService } from './match-reminder.service';
import { MatchLiveScoreController } from './live-score/match-live-score.controller';
import { MatchLiveScoreService } from './live-score/match-live-score.service';
import { MatchLiveScoreRepository } from './live-score/match-live-score.repository';

@Module({
  imports: [
    ScheduleModule,
    RealtimeModule,
    NotificationsModule,
    ReportsModule,
    forwardRef(() => ClubsModule),
    CompetitiveScoringModule,
    BadgesModule,
    forwardRef(() => ChallengesModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [MatchesController, MatchLiveScoreController],
  providers: [
    MatchesService,
    MatchesRepository,
    MatchResultExpiryService,
    MatchReminderService,
    MatchLiveScoreService,
    MatchLiveScoreRepository,
  ],
  exports: [MatchesService, MatchesRepository],
})
export class MatchesModule {}

