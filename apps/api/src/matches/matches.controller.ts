import {
  Patch,
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMatchDto } from './dto/create-match.dto';
import { ListOpenMatchesQueryDto } from './dto/list-open-matches.query.dto';
import { CreateMatchResultDto } from './dto/create-match-result.dto';
import { ConfirmMatchResultDto } from './dto/confirm-match-result.dto';
import { RejectMatchResultDto } from './dto/reject-match-result.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';
import { AddMatchInvitesDto } from './dto/add-match-invites.dto';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Post()
  createMatch(@CurrentUser() user: any, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(user.sub, dto);
  }

  @Get()
  findAll() {
    return this.matchesService.findAll();
  }

  @Get('me')
  async getMyMatches(@CurrentUser() user: any) {
    return this.matchesService.getMyMatches(user.sub);
  }

  @Get('open')
  listOpenMatches(@CurrentUser() user: any, @Query() query: ListOpenMatchesQueryDto) {
    return this.matchesService.listOpenMatches(user.sub, query);
  }

  @Get(':id/deposit')
  getDeposit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.getDepositStatus(id, user.sub);
  }

  @Post(':id/deposit/checkout')
  createDepositCheckout(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.createDepositCheckout(id, user.sub);
  }

  @Post(':id/deposit/simulate')
  simulateDeposit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.simulateDepositPayment(id, user.sub);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.findOne(id, user.sub);
  }

  @Post(':id/join')
  joinMatch(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.joinMatch(id, user.sub);
  }

  @Post(':id/invites')
  addInvites(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: AddMatchInvitesDto) {
    return this.matchesService.addInvites(id, user.sub, dto);
  }

  @Post(':id/join-requests/:userId/accept')
  acceptJoinRequest(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.matchesService.acceptJoinRequest(id, userId, user.sub);
  }

  @Post(':id/join-requests/:userId/reject')
  rejectJoinRequest(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.matchesService.rejectJoinRequest(id, userId, user.sub);
  }

  @Post(':id/leave')
  leaveMatch(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.leaveMatch(id, user.sub);
  }

  @Post(':id/cancel')
  cancelMatch(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.cancelMatch(id, user.sub);
  }

  @Post(':id/confirm')
  confirmMatch(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.confirmMatch(id, user.sub);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMatchStatusDto) {
    return this.matchesService.updateMatchStatus(id, dto);
  }

  @Post(':id/result')
  async submitResult(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateMatchResultDto,
  ) {
    return this.matchesService.submitResult(id, user.sub, dto);
  }

  @Post(':id/rival-reviews')
  submitRivalReviews(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ConfirmMatchResultDto,
  ) {
    return this.matchesService.submitRivalReviews(id, user.sub, dto);
  }

  @Post(':id/result/reject')
  rejectResult(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RejectMatchResultDto,
  ) {
    return this.matchesService.rejectResult(id, user.sub, dto);
  }

  @Post(':id/result/confirm')
  confirmResult(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ConfirmMatchResultDto,
  ) {
    return this.matchesService.confirmResult(id, user.sub, dto);
  }
}
