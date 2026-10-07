import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CircuitsEnabledGuard } from '../common/features';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CircuitsService } from './circuits.service';
import { CircuitStaffService } from './circuit-staff.service';
import { FixtureSchedulerService } from './scheduling/fixture-scheduler.service';
import { AddCircuitCategoryDto } from './dto/add-circuit-category.dto';
import { AddCircuitVenueDto } from './dto/add-circuit-venue.dto';
import {
  InviteCircuitStaffDto,
  TransferCircuitPresidencyDto,
  UpdateCircuitStaffDto,
} from './dto/circuit-staff.dto';
import { CreateCircuitDto, UpdateCircuitDto } from './dto/create-circuit.dto';
import { CreateCircuitStageDto } from './dto/create-circuit-stage.dto';
import {
  CreateCircuitEventDto,
  EnsureEventBracketsDto,
  PreviewEventScheduleDto,
  PublishCircuitStageDto,
  UpdateMatchScheduleDto,
  UpsertCircuitPointRulesDto,
} from './dto/circuit-stage.dto';

@Controller('circuits')
@UseGuards(CircuitsEnabledGuard)
export class CircuitsController {
  constructor(
    private readonly circuitsService: CircuitsService,
    private readonly staffService: CircuitStaffService,
    private readonly fixtureScheduler: FixtureSchedulerService,
  ) {}

  @Get()
  list() {
    return this.circuitsService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateCircuitDto) {
    return this.circuitsService.create(user.sub, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: { sub: string }) {
    return this.circuitsService.listMine(user.sub);
  }

  @Get('staff/invitations/me')
  @UseGuards(JwtAuthGuard)
  myInvitations(@CurrentUser() user: { sub: string }) {
    return this.staffService.myInvitations(user.sub);
  }

  @Post('staff/invitations/:memberId/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvitation(@Param('memberId') memberId: string, @CurrentUser() user: { sub: string }) {
    return this.staffService.respond(memberId, user.sub, true);
  }

  @Post('staff/invitations/:memberId/decline')
  @UseGuards(JwtAuthGuard)
  declineInvitation(@Param('memberId') memberId: string, @CurrentUser() user: { sub: string }) {
    return this.staffService.respond(memberId, user.sub, false);
  }

  /** Cargos activos del usuario en circuitos (carteles del perfil). */
  @Get('roles/user/:userId')
  rolesForUser(@Param('userId') userId: string) {
    return this.staffService.rolesForUser(userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getById(@Param('id') id: string, @CurrentUser() user?: { sub: string }) {
    return this.circuitsService.getById(id, user?.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateCircuitDto,
  ) {
    return this.circuitsService.update(id, user.sub, dto);
  }

  @Post(':id/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          cb(new BadRequestException('Solo se permiten imágenes'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadLogo(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.circuitsService.uploadLogo(id, user.sub, file);
  }

  @Get(':id/me')
  @UseGuards(OptionalJwtAuthGuard)
  myAccess(@Param('id') id: string, @CurrentUser() user?: { sub: string }) {
    return this.circuitsService.getViewerAccess(id, user?.sub);
  }

  @Get(':id/staff')
  @UseGuards(OptionalJwtAuthGuard)
  listStaff(@Param('id') id: string, @CurrentUser() user?: { sub: string }) {
    return this.staffService.listStaff(id, user?.sub);
  }

  @Post(':id/staff')
  @UseGuards(JwtAuthGuard)
  inviteStaff(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: InviteCircuitStaffDto,
  ) {
    return this.staffService.invite(id, user.sub, dto);
  }

  @Patch(':id/staff/:memberId')
  @UseGuards(JwtAuthGuard)
  updateStaff(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateCircuitStaffDto,
  ) {
    return this.staffService.updateMember(id, user.sub, memberId, dto);
  }

  @Delete(':id/staff/:memberId')
  @UseGuards(JwtAuthGuard)
  removeStaff(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.staffService.removeMember(id, user.sub, memberId);
  }

  @Post(':id/staff/transfer-presidency')
  @UseGuards(JwtAuthGuard)
  transferPresidency(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: TransferCircuitPresidencyDto,
  ) {
    return this.staffService.transferPresidency(id, user.sub, dto);
  }

  @Get(':id/rankings')
  rankings(@Param('id') id: string, @Query('categoryId') categoryId?: string) {
    return this.circuitsService.getRankings(id, categoryId);
  }

  @Get(':id/point-rules')
  pointRules(@Param('id') id: string) {
    return this.circuitsService.getPointRules(id);
  }

  @Put(':id/point-rules')
  @UseGuards(JwtAuthGuard)
  upsertPointRules(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpsertCircuitPointRulesDto,
  ) {
    return this.circuitsService.upsertPointRules(id, user.sub, dto);
  }

  @Post(':id/categories')
  @UseGuards(JwtAuthGuard)
  addCategory(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: AddCircuitCategoryDto,
  ) {
    return this.circuitsService.addCategory(id, user.sub, dto);
  }

  @Post(':id/venues')
  @UseGuards(JwtAuthGuard)
  addVenue(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: AddCircuitVenueDto,
  ) {
    return this.circuitsService.addVenue(id, user.sub, dto);
  }

  @Post(':id/stages')
  @UseGuards(JwtAuthGuard)
  addStage(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCircuitStageDto,
  ) {
    return this.circuitsService.addStage(id, user.sub, dto);
  }

  /** Crea una etapa (evento multi-sede + una stage por categoría). */
  @Post(':id/events')
  @UseGuards(JwtAuthGuard)
  createEvent(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCircuitEventDto,
  ) {
    return this.circuitsService.createEvent(id, user.sub, dto);
  }

  @Get(':id/events')
  listEvents(@Param('id') id: string) {
    return this.circuitsService.listEvents(id);
  }

  @Get(':id/events/:eventId')
  getEvent(@Param('id') id: string, @Param('eventId') eventId: string) {
    return this.circuitsService.getEvent(id, eventId);
  }

  @Get(':id/events/:eventId/schedule')
  @UseGuards(OptionalJwtAuthGuard)
  getSchedule(
    @CurrentUser() user: { sub: string } | undefined,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Query('categoryId') categoryId?: string,
    @Query('clubId') clubId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('includeDraft') includeDraft?: string,
  ) {
    return this.fixtureScheduler.getPublishedSchedule(id, eventId, {
      categoryId,
      clubId,
      date,
      status,
      q,
      includeDraft: includeDraft === '1' || includeDraft === 'true',
      viewerUserId: user?.sub,
    });
  }

  @Get(':id/events/:eventId/my-matches')
  @UseGuards(JwtAuthGuard)
  myMatches(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.fixtureScheduler.getMyEventMatches(id, eventId, user.sub);
  }

  @Post(':id/events/:eventId/brackets')
  @UseGuards(JwtAuthGuard)
  ensureBrackets(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: EnsureEventBracketsDto,
  ) {
    return this.fixtureScheduler.ensureBracketsForEvent(id, eventId, user.sub, {
      mode: dto.mode,
      regenerate: dto.regenerate,
    });
  }

  @Post(':id/events/:eventId/schedule/preview')
  @UseGuards(JwtAuthGuard)
  previewSchedule(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: PreviewEventScheduleDto,
  ) {
    return this.fixtureScheduler.previewEventSchedule(id, eventId, user.sub, dto);
  }

  @Post(':id/events/:eventId/schedule/apply')
  @UseGuards(JwtAuthGuard)
  applySchedule(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: PreviewEventScheduleDto,
  ) {
    return this.fixtureScheduler.applyEventSchedule(id, eventId, user.sub, dto);
  }

  @Post(':id/events/:eventId/schedule/publish')
  @UseGuards(JwtAuthGuard)
  publishSchedule(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.fixtureScheduler.publishExistingSchedule(id, eventId, user.sub);
  }

  @Patch(':id/events/:eventId/matches/:matchId/schedule')
  @UseGuards(JwtAuthGuard)
  updateMatchSchedule(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateMatchScheduleDto,
  ) {
    return this.fixtureScheduler.updateMatchSchedule(id, eventId, matchId, user.sub, dto);
  }

  @Post(':id/stages/:stageId/publish')
  @UseGuards(JwtAuthGuard)
  publishStage(
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: PublishCircuitStageDto,
  ) {
    return this.circuitsService.publishStage(id, stageId, user.sub, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.circuitsService.publish(id, user.sub);
  }
}
