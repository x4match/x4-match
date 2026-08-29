import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('master')
export class MasterController {
  constructor(private masterService: MasterService) {}

  @Get('current')
  async getCurrentSeason() {
    return this.masterService.getCurrentSeason();
  }

  @Get('seasons')
  async getSeasons() {
    return this.masterService.getSeasons();
  }

  @Get('event/:id')
  async getEvent(@Param('id') id: string) {
    return this.masterService.getEvent(id);
  }

  @Get('my-status')
  @UseGuards(JwtAuthGuard)
  async getMyStatus(@CurrentUser() user: any) {
    return this.masterService.getMyTournamentStatus(user.sub);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  async registerForMaster(
    @CurrentUser() user: any,
    @Body() data: { eventId: string; partnerId: string },
  ) {
    return this.masterService.registerForMaster(
      data.eventId,
      user.sub,
      data.partnerId,
    );
  }

  @Post('season')
  @UseGuards(JwtAuthGuard)
  async createSeason(@Body() data: { name: string; startDate: string; endDate: string }) {
    return this.masterService.createSeason({
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });
  }

  @Post('season/:seasonId/event')
  @UseGuards(JwtAuthGuard)
  async createEvent(
    @Param('seasonId') seasonId: string,
    @Body() data: { name: string; eventDate?: string },
  ) {
    return this.masterService.createEvent(seasonId, {
      name: data.name,
      eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
    });
  }

  @Post('event/:id/generate-bracket')
  @UseGuards(JwtAuthGuard)
  async generateBracket(@Param('id') id: string) {
    return this.masterService.generateBracket(id);
  }

  @Post('match/:id/result')
  @UseGuards(JwtAuthGuard)
  async submitMatchResult(
    @Param('id') id: string,
    @Body() data: { teamAScore: number; teamBScore: number },
  ) {
    return this.masterService.submitMatchResult(id, data.teamAScore, data.teamBScore);
  }
}
