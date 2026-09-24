import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import {
  PlatformShopAdminController,
  PlatformShopController,
  SponsorsPartnerController,
  SponsorsPublicController,
} from './platform-shop.controller';
import { PlatformShopService } from './platform-shop.service';
import { SponsorMemberGuard } from './sponsor-member.guard';
import { SponsorPaymentsService } from './sponsor-payments.service';

@Module({
  controllers: [
    PlatformShopController,
    // Partner antes que Public: evita que GET /sponsors/:slug capture "me".
    SponsorsPartnerController,
    SponsorsPublicController,
    PlatformShopAdminController,
  ],
  providers: [
    PlatformShopService,
    SponsorPaymentsService,
    PlatformAdminGuard,
    SponsorMemberGuard,
  ],
  exports: [PlatformShopService, SponsorPaymentsService],
})
export class PlatformShopModule {}
