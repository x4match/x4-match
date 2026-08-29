import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.friendsService.listFriends(user.sub);
  }

  @Get('pending')
  pending(@CurrentUser() user: { sub: string }) {
    return this.friendsService.listPending(user.sub);
  }

  @Get('relation/:userId')
  relation(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.friendsService.getRelation(user.sub, userId);
  }

  @Post('request/:userId')
  request(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.friendsService.sendRequest(user.sub, userId);
  }

  @Post('accept/:requestId')
  accept(@CurrentUser() user: { sub: string }, @Param('requestId') requestId: string) {
    return this.friendsService.acceptRequest(user.sub, requestId);
  }

  @Post('reject/:requestId')
  reject(@CurrentUser() user: { sub: string }, @Param('requestId') requestId: string) {
    return this.friendsService.rejectRequest(user.sub, requestId);
  }

  @Delete(':friendId')
  remove(@CurrentUser() user: { sub: string }, @Param('friendId') friendId: string) {
    return this.friendsService.removeFriend(user.sub, friendId);
  }
}
