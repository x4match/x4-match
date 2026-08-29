import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { MatchesModule } from '../matches/matches.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [forwardRef(() => MatchesModule), RealtimeModule],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
