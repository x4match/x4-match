import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PlayersRepository } from './players.repository';

@Module({
  imports: [UsersModule],
  controllers: [PlayersController],
  providers: [PlayersService, PlayersRepository],
  exports: [PlayersService, PlayersRepository],
})
export class PlayersModule {}
