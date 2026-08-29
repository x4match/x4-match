import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FollowsService } from './follows.service';

@Controller('follows')
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get('counts/:userId')
  counts(@Param('userId') userId: string) {
    return this.followsService.getCounts(userId);
  }

  @Get('me/counts')
  myCounts(@CurrentUser() user: { sub: string }) {
    return this.followsService.getCounts(user.sub);
  }

  @Get('followers/:userId')
  followers(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.followsService.listFollowers(userId, limit ? Number(limit) : 50);
  }

  @Get('following/:userId')
  following(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.followsService.listFollowing(userId, limit ? Number(limit) : 50);
  }

  @Get('relation/:userId')
  relation(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.followsService.getRelation(user.sub, userId);
  }

  @Post(':userId')
  follow(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.followsService.follow(user.sub, userId);
  }

  @Delete(':userId')
  unfollow(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.followsService.unfollow(user.sub, userId);
  }
}
