import { Module, forwardRef } from '@nestjs/common';
import { ClubPaymentConfigModule } from '../clubs/club-payment-config.module';
import { MatchesModule } from '../matches/matches.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { PAYMENTS_SERVICE } from './payments.tokens';

@Module({
  imports: [forwardRef(() => MatchesModule), RealtimeModule, ClubPaymentConfigModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    { provide: PAYMENTS_SERVICE, useExisting: PaymentsService },
  ],
  exports: [PaymentsService, PAYMENTS_SERVICE],
})
export class PaymentsModule {}
