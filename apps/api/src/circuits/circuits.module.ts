import { Module } from '@nestjs/common';
import { CircuitsController } from './circuits.controller';
import { CircuitOrganizerController } from './circuit-organizer.controller';
import { CircuitsService } from './circuits.service';
import { CircuitAccessService } from './circuit-access.service';
import { CircuitStaffService } from './circuit-staff.service';
import { CircuitAuditService } from './organizer/circuit-audit.service';
import { CircuitContentService } from './organizer/circuit-content.service';
import { CircuitPlayersService } from './organizer/circuit-players.service';
import { FixtureSchedulerService } from './scheduling/fixture-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { BracketsModule } from '../tournaments/brackets/brackets.module';

@Module({
  imports: [RealtimeModule, NotificationsModule, BracketsModule],
  controllers: [CircuitsController, CircuitOrganizerController],
  providers: [
    CircuitsService,
    CircuitAccessService,
    CircuitStaffService,
    CircuitAuditService,
    CircuitContentService,
    CircuitPlayersService,
    FixtureSchedulerService,
    OptionalJwtAuthGuard,
  ],
  exports: [
    CircuitsService,
    CircuitAccessService,
    CircuitAuditService,
    CircuitPlayersService,
    FixtureSchedulerService,
  ],
})
export class CircuitsModule {}
