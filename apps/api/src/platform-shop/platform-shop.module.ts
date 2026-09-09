import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { PlatformShopAdminController, PlatformShopController } from './platform-shop.controller';
import { PlatformShopService } from './platform-shop.service';

@Module({
  controllers: [PlatformShopController, PlatformShopAdminController],
  providers: [PlatformShopService, PlatformAdminGuard],
  exports: [PlatformShopService],
})
export class PlatformShopModule {}
