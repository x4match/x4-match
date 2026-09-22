import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CircuitsService } from './circuits.service';
import { FixtureSchedulerService } from './scheduling/fixture-scheduler.service';
import { AddCircuitCategoryDto } from './dto/add-circuit-category.dto';
import { AddCircuitVenueDto } from './dto/add-circuit-venue.dto';
import { CreateCircuitDto } from './dto/create-circuit.dto';
import { CreateCircuitStageDto } from './dto/create-circuit-stage.dto';
import {
  CreateCircuitEventDto,
  EnsureEventBracketsDto,
  PreviewEventScheduleDto,
  PublishCircuitStageDto,
  UpdateMatchScheduleDto,
  UpsertCircuitPointRulesDto,
} from './dto/circuit-wpe.dto';

@Controller('circuits')
export class CircuitsController {
  constructor(
    private readonly circuitsService: CircuitsService,
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

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.circuitsService.getById(id);
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

  /** Crea una etapa WPE (evento multi-sede + una stage por categoría). */
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
  getSchedule(
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
    return this.fixtureScheduler.ensureBracketsForEvent(
      id,
      eventId,
      user.sub,
      dto.mode ?? 'OPEN_COURT',
    );
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
