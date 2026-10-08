import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MatchLiveScoreService } from './match-live-score.service';
import { StartLiveScoreDto } from './dto/start-live-score.dto';
import { LiveScorePointDto, LiveScoreUndoDto } from './dto/live-score-action.dto';

@Controller('matches/:id/live')
@UseGuards(JwtAuthGuard)
export class MatchLiveScoreController {
  constructor(private readonly liveScoreService: MatchLiveScoreService) {}

  @Get()
  getLive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.liveScoreService.getLive(id, user.sub);
  }

  @Post('start')
  start(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: StartLiveScoreDto) {
    return this.liveScoreService.start(id, user.sub, dto);
  }

  @Post('point')
  addPoint(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: LiveScorePointDto) {
    return this.liveScoreService.addPoint(id, user.sub, dto.team, dto.version);
  }

  @Post('undo')
  undo(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: LiveScoreUndoDto) {
    return this.liveScoreService.undo(id, user.sub, dto.version);
  }

  @Delete()
  discard(@Param('id') id: string, @CurrentUser() user: any) {
    return this.liveScoreService.discard(id, user.sub);
  }
}
