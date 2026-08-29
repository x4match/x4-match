import { Global, Module } from '@nestjs/common';
import { ClubPaymentConfigService } from './club-payment-config.service';

@Global()
@Module({
  providers: [ClubPaymentConfigService],
  exports: [ClubPaymentConfigService],
})
export class ClubPaymentConfigModule {}
