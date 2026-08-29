import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CommunityService } from './community.service';

@Controller('community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('feed')
  feed(@CurrentUser() user: { sub: string }) {
    return this.communityService.feed(user.sub);
  }

  @Get('recent-matches')
  recentMatches(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 30, 50) : 30;
    return this.communityService.recentMatches(parsedLimit);
  }

  @Get('players-nearby')
  playersNearby(
    @CurrentUser() user: { sub: string },
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.communityService.nearbyPlayers(user.sub, {
      lat: lat != null ? parseFloat(lat) : undefined,
      lng: lng != null ? parseFloat(lng) : undefined,
      radiusKm: radiusKm != null ? parseFloat(radiusKm) : undefined,
    });
  }
}
