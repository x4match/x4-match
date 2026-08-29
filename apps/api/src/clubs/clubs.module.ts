import { Module, forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ClubGapFillCron } from './club-gap-fill.cron';
import { ClubGapFillService } from './club-gap-fill.service';
import { ClubManagerService } from './club-manager.service';
import { ClubsController } from './clubs.controller';
import { ClubCommentsService } from './club-comments.service';
import { ClubPointsService } from './club-points.service';
import { ClubTrialService } from './club-trial.service';
import { ClubsService } from './clubs.service';

@Module({
  imports: [TournamentsModule, NotificationsModule, forwardRef(() => PaymentsModule)],
  controllers: [ClubsController],
  providers: [
    ClubsService,
    ClubTrialService,
    ClubPointsService,
    ClubCommentsService,
    ClubGapFillService,
    ClubGapFillCron,
    ClubManagerService,
    OptionalJwtAuthGuard,
  ],
  exports: [
    ClubsService,
    ClubTrialService,
    ClubPointsService,
    ClubCommentsService,
    ClubGapFillService,
    ClubManagerService,
  ],
})
export class ClubsModule {}
