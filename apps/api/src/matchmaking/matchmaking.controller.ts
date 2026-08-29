import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Param,
} from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMatchRequestDto } from './dto/create-match-request.dto';
import { RunMatchmakingDto } from './dto/run-matchmaking.dto';

@Controller('match-requests')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private matchmakingService: MatchmakingService) {}

  @Post()
  async createMatchRequest(
    @CurrentUser() user: any,
    @Body() dto: CreateMatchRequestDto,
  ) {
    return this.matchmakingService.createMatchRequest(user.sub, {
      ...dto,
      date: new Date(dto.date),
    });
  }

  @Post('run/:id')
  async runMatchmaking(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RunMatchmakingDto,
  ) {
    return this.matchmakingService.runMatchmaking(id, user.sub, dto.invites, dto.mode, dto.gender);
  }

  @Get('me')
  async getMyMatchRequests(@CurrentUser() user: any) {
    return this.matchmakingService.getMyMatchRequests(user.sub);
  }
}

