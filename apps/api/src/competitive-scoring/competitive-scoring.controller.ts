import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompetitiveScoringService } from './competitive-scoring.service';

@Controller('competitive-scoring')
export class CompetitiveScoringController {
  constructor(private readonly competitiveScoringService: CompetitiveScoringService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyPoints(
    @CurrentUser() user: { sub: string },
    @Query('month') month?: string,
  ) {
    return this.competitiveScoringService.getMyMonthlyPoints(user.sub, month);
  }

  @Get('leaderboard')
  getLeaderboard(
    @Query('month') month?: string,
    @Query('category') category?: string,
    @Query('gender') gender?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    return this.competitiveScoringService.getMonthlyLeaderboard(
      month,
      category,
      gender,
      parsedLimit,
    );
  }
}
