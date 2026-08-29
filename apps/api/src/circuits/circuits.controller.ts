import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CircuitsService } from './circuits.service';
import { AddCircuitCategoryDto } from './dto/add-circuit-category.dto';
import { AddCircuitVenueDto } from './dto/add-circuit-venue.dto';
import { CreateCircuitDto } from './dto/create-circuit.dto';
import { CreateCircuitStageDto } from './dto/create-circuit-stage.dto';

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

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.circuitsService.publish(id, user.sub);
  }
}
