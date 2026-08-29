import { Controller, Get, Param, Query } from '@nestjs/common';
import { RankingsService } from './rankings.service';

@Controller('rankings')
export class RankingsController {
  constructor(private rankingsService: RankingsService) {}

  @Get('weekly')
  async getWeeklyRanking(
    @Query('clubId') clubId?: string,
    @Query('category') category?: string,
    @Query('weekKey') weekKey?: string,
  ) {
    return this.rankingsService.getWeeklyRanking(clubId, category, weekKey);
  }

  @Get('monthly')
  async getMonthlyRanking(
    @Query('clubId') clubId?: string,
    @Query('category') category?: string,
  ) {
    return this.rankingsService.getMonthlyRanking(clubId, category);
  }

  @Get('player-of-the-week/:clubId')
  async getPlayerOfTheWeek(@Param('clubId') clubId: string) {
    return this.rankingsService.getPlayerOfTheWeek(clubId);
  }

  @Get('club/:clubId')
  async getClubRanking(
    @Param('clubId') clubId: string,
    @Query('limit') limit?: string,
  ) {
    return this.rankingsService.getClubRanking(
      clubId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
