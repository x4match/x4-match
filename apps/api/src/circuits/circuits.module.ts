import { Module } from '@nestjs/common';
import { CircuitsController } from './circuits.controller';
import { CircuitsService } from './circuits.service';
import { FixtureSchedulerService } from './scheduling/fixture-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [CircuitsController],
  providers: [CircuitsService, FixtureSchedulerService],
  exports: [CircuitsService, FixtureSchedulerService],
})
export class CircuitsModule {}
