import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CircuitsService } from './circuits.service';
import { AddCircuitCategoryDto } from './dto/add-circuit-category.dto';
import { AddCircuitVenueDto } from './dto/add-circuit-venue.dto';
import { CreateCircuitDto } from './dto/create-circuit.dto';
import { CreateCircuitStageDto } from './dto/create-circuit-stage.dto';
import {
  CreateCircuitEventDto,
  PublishCircuitStageDto,
  UpsertCircuitPointRulesDto,
} from './dto/circuit-wpe.dto';

@Controller('circuits')
export class CircuitsController {
  constructor(private readonly circuitsService: CircuitsService) {}

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

  /** Crea una etapa WPE (una stage por categoría). */
  @Post(':id/events')
  @UseGuards(JwtAuthGuard)
  createEvent(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCircuitEventDto,
  ) {
    return this.circuitsService.createEvent(id, user.sub, dto);
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
