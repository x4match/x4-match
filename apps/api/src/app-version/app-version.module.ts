import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { AppVersionController, PlatformAppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

@Module({
  controllers: [AppVersionController, PlatformAppVersionController],
  providers: [AppVersionService, PlatformAdminGuard],
})
export class AppVersionModule {}
