import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import {
  PlatformShopAdminController,
  PlatformShopController,
  SponsorsPartnerController,
  SponsorsPublicController,
} from './platform-shop.controller';
import { PlatformShopService } from './platform-shop.service';
import { SponsorMemberGuard } from './sponsor-member.guard';
import { ShopProtectionService } from './shop-protection.service';
import { SponsorPaymentsService } from './sponsor-payments.service';
import { TiendaNubeCatalogService } from './tienda-nube-catalog.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    PlatformShopController,
    // Partner antes que Public: evita que GET /sponsors/:slug capture "me".
    SponsorsPartnerController,
    SponsorsPublicController,
    PlatformShopAdminController,
  ],
  providers: [
    PlatformShopService,
    ShopProtectionService,
    SponsorPaymentsService,
    TiendaNubeCatalogService,
    PlatformAdminGuard,
    SponsorMemberGuard,
  ],
  exports: [PlatformShopService, SponsorPaymentsService, TiendaNubeCatalogService],
})
export class PlatformShopModule {}
