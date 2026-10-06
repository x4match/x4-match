import { Module, forwardRef } from '@nestjs/common';
import { CircuitsModule } from '../circuits/circuits.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BracketsModule } from './brackets/brackets.module';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { TournamentsAutoCloseService } from './tournaments-auto-close.service';

@Module({
  imports: [RealtimeModule, BracketsModule, forwardRef(() => CircuitsModule)],
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentsAutoCloseService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
