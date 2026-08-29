import { Module } from '@nestjs/common';
import { ClubTrialService } from '../clubs/club-trial.service';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService, PlatformAdminGuard, ClubTrialService],
})
export class PlatformAdminModule {}
