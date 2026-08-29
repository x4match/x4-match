import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BadgesService } from './badges.service';

@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  listCatalog() {
    return this.badgesService.listCatalog();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyBadges(@CurrentUser() user: { sub: string }) {
    return this.badgesService.getUserBadgesSummary(user.sub);
  }

  @Get('user/:userId')
  getUserBadges(@Param('userId') userId: string) {
    return this.badgesService.getUserBadgesSummary(userId);
  }
}
