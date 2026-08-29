import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClubTrialService } from '../clubs/club-trial.service';
import { TrialChecklistKey } from '../clubs/club-trial.constants';
import {
  CreateOpsUserDto,
  ExtendTrialDto,
  OpsNotesDto,
  StartClubTrialDto,
  SuspendClubDto,
  UpdateChecklistItemDto,
  UpdateUserRoleDto,
} from './dto/platform-admin.dto';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly platformAdminService: PlatformAdminService,
    private readonly clubTrialService: ClubTrialService,
  ) {}

  @Get('monitor')
  getMonitor() {
    return this.platformAdminService.getMonitor();
  }

  @Get('clubs')
  listClubs(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('mpStatus') mpStatus?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformAdminService.listClubs({
      q,
      status,
      mpStatus,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('clubs/:id')
  async getClub(@Param('id') id: string) {
    const detail = await this.platformAdminService.getClubDetail(id);
    if (!detail) throw new NotFoundException('Club no encontrado');
    return detail;
  }

  @Get('clubs/:id/trial')
  getClubTrial(@Param('id') id: string) {
    return this.clubTrialService.getTrialStatus(id);
  }

  @Post('clubs/:id/trial/start')
  startTrial(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: StartClubTrialDto,
  ) {
    return this.clubTrialService.startTrial({
      clubId: id,
      mode: dto.mode,
      trialDays: dto.trialDays,
      force: dto.force,
      userId: user.sub,
    });
  }

  @Patch('clubs/:id/trial/checklist')
  updateChecklist(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.clubTrialService.updateChecklistItem(
      id,
      dto.key as TrialChecklistKey,
      dto.done,
      user.sub,
      dto.note,
    );
  }

  @Post('clubs/:id/trial/extend')
  extendTrial(@Param('id') id: string, @Body() dto: ExtendTrialDto) {
    return this.clubTrialService.extendTrial(id, dto.extraDays);
  }

  @Post('clubs/:id/billing/activate')
  activatePaid(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubTrialService.activatePaid(id, user.sub);
  }

  @Post('clubs/:id/billing/deactivate')
  deactivatePaid(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubTrialService.deactivatePaid(id, user.sub);
  }

  @Post('clubs/:id/billing/reactivate')
  reactivate(@Param('id') id: string) {
    return this.clubTrialService.reactivate(id);
  }

  @Post('clubs/:id/billing/grace')
  enterGrace(@Param('id') id: string, @Query('days') days?: string) {
    return this.clubTrialService.enterGrace(id, days ? parseInt(days, 10) : 7);
  }

  @Post('clubs/:id/billing/suspend')
  suspend(@Param('id') id: string, @Body() dto: SuspendClubDto) {
    return this.clubTrialService.suspend(id, dto.notes);
  }

  @Patch('clubs/:id/ops-notes')
  setOpsNotes(@Param('id') id: string, @Body() dto: OpsNotesDto) {
    return this.clubTrialService.setOpsNotes(id, dto.notes);
  }

  @Get('users')
  listUsers(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformAdminService.listUsers({
      q,
      role,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('users/ops')
  listOpsUsers() {
    return this.platformAdminService.listOpsUsers();
  }

  @Post('users/ops')
  createOpsUser(@Body() dto: CreateOpsUserDto) {
    return this.platformAdminService.createOpsUser(dto);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.platformAdminService.updateUserRole(id, dto.role, user.sub);
  }

  @Get('matches')
  listMatches(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('clubId') clubId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformAdminService.listMatches({
      q,
      status,
      clubId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('tournaments')
  listTournaments(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('clubId') clubId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformAdminService.listTournaments({
      q,
      status,
      clubId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('payments')
  listPayments(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('clubId') clubId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformAdminService.listPayments({
      q,
      status,
      provider,
      clubId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('trials')
  listTrials(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('mode') mode?: string,
    @Query('expiringDays') expiringDays?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformAdminService.listTrials({
      q,
      status,
      mode,
      expiringDays: expiringDays ? parseInt(expiringDays, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
