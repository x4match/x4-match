import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [ReportsModule, NotificationsModule],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
