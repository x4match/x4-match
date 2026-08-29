import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [FriendsModule],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
