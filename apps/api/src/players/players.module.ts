import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../reports/reports.module';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PlayersRepository } from './players.repository';

@Module({
  imports: [UsersModule, ReportsModule],
  controllers: [PlayersController],
  providers: [PlayersService, PlayersRepository, OptionalJwtAuthGuard],
  exports: [PlayersService, PlayersRepository],
})
export class PlayersModule {}
