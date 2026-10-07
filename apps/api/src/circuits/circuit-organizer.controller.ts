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
import {
  ApplyLevelChangesDto,
  CreateCircuitNewsDto,
  CreateCircuitPlayerDto,
  CreateCircuitSponsorDto,
  SetCircuitPlayerLevelDto,
  UpdateCircuitNewsDto,
  UpdateCircuitPlayerDto,
  UpdateCircuitSponsorDto,
} from './dto/circuit-organizer.dto';
import { CircuitAuditService } from './organizer/circuit-audit.service';
import { CircuitContentService } from './organizer/circuit-content.service';
import { CircuitPlayersService } from './organizer/circuit-players.service';

const imageUpload = (field: string) =>
  FileInterceptor(field, {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype?.startsWith('image/')) {
        cb(new BadRequestException('Solo se permiten imágenes'), false);
        return;
      }
      cb(null, true);
    },
  });

type AuthUser = { sub: string };

/** Padrón, ascensos/descensos, noticias, sponsors e historial de acciones del circuito. */
@Controller('circuits')
@UseGuards(CircuitsEnabledGuard)
export class CircuitOrganizerController {
  constructor(
    private readonly players: CircuitPlayersService,
    private readonly content: CircuitContentService,
    private readonly audit: CircuitAuditService,
  ) {}

  // --- Padrón ---

  @Get(':id/players')
  @UseGuards(OptionalJwtAuthGuard)
  listPlayers(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query('q') q?: string,
    @Query('level') level?: string,
    @Query('status') status?: string,
  ) {
    return this.players.list(id, user?.sub, {
      q,
      level: level ? Number(level) : undefined,
      status,
    });
  }

  @Post(':id/players')
  @UseGuards(JwtAuthGuard)
  createPlayer(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: CreateCircuitPlayerDto) {
    return this.players.create(id, user.sub, dto);
  }

  @Post(':id/players/sync')
  @UseGuards(JwtAuthGuard)
  syncPlayers(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.players.syncFromRegistrations(id, user.sub);
  }

  @Get(':id/players/promotions')
  @UseGuards(JwtAuthGuard)
  promotions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('promoteTop') promoteTop?: string,
    @Query('relegateBottom') relegateBottom?: string,
  ) {
    return this.players.promotionSuggestions(id, user.sub, {
      promoteTop: promoteTop !== undefined ? Number(promoteTop) : undefined,
      relegateBottom: relegateBottom !== undefined ? Number(relegateBottom) : undefined,
    });
  }

  @Post(':id/players/level-changes')
  @UseGuards(JwtAuthGuard)
  applyLevelChanges(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApplyLevelChangesDto,
  ) {
    return this.players.applyLevelChanges(id, user.sub, dto);
  }

  @Get(':id/players/:playerId')
  @UseGuards(OptionalJwtAuthGuard)
  getPlayer(
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.players.getOne(id, playerId, user?.sub);
  }

  @Patch(':id/players/:playerId')
  @UseGuards(JwtAuthGuard)
  updatePlayer(
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCircuitPlayerDto,
  ) {
    return this.players.update(id, playerId, user.sub, dto);
  }

  @Put(':id/players/:playerId/level')
  @UseGuards(JwtAuthGuard)
  setPlayerLevel(
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetCircuitPlayerLevelDto,
  ) {
    return this.players.setLevel(id, playerId, user.sub, dto);
  }

  // --- Noticias ---

  @Get(':id/news')
  listNews(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.content.listNews(id, limit ? Number(limit) : undefined);
  }

  @Post(':id/news')
  @UseGuards(JwtAuthGuard)
  createNews(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: CreateCircuitNewsDto) {
    return this.content.createNews(id, user.sub, dto);
  }

  @Patch(':id/news/:newsId')
  @UseGuards(JwtAuthGuard)
  updateNews(
    @Param('id') id: string,
    @Param('newsId') newsId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCircuitNewsDto,
  ) {
    return this.content.updateNews(id, newsId, user.sub, dto);
  }

  @Post(':id/news/:newsId/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload('image'))
  uploadNewsImage(
    @Param('id') id: string,
    @Param('newsId') newsId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.content.uploadNewsImage(id, newsId, user.sub, file);
  }

  @Delete(':id/news/:newsId')
  @UseGuards(JwtAuthGuard)
  deleteNews(@Param('id') id: string, @Param('newsId') newsId: string, @CurrentUser() user: AuthUser) {
    return this.content.deleteNews(id, newsId, user.sub);
  }

  // --- Sponsors ---

  @Get(':id/sponsors')
  listSponsors(@Param('id') id: string) {
    return this.content.listSponsors(id);
  }

  @Post(':id/sponsors')
  @UseGuards(JwtAuthGuard)
  createSponsor(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCircuitSponsorDto,
  ) {
    return this.content.createSponsor(id, user.sub, dto);
  }

  @Patch(':id/sponsors/:sponsorId')
  @UseGuards(JwtAuthGuard)
  updateSponsor(
    @Param('id') id: string,
    @Param('sponsorId') sponsorId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCircuitSponsorDto,
  ) {
    return this.content.updateSponsor(id, sponsorId, user.sub, dto);
  }

  @Post(':id/sponsors/:sponsorId/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUpload('logo'))
  uploadSponsorLogo(
    @Param('id') id: string,
    @Param('sponsorId') sponsorId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.content.uploadSponsorLogo(id, sponsorId, user.sub, file);
  }

  @Delete(':id/sponsors/:sponsorId')
  @UseGuards(JwtAuthGuard)
  deleteSponsor(
    @Param('id') id: string,
    @Param('sponsorId') sponsorId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.content.deleteSponsor(id, sponsorId, user.sub);
  }

  // --- Historial de acciones ---

  @Get(':id/activity')
  @UseGuards(JwtAuthGuard)
  activity(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('action') action?: string,
  ) {
    return this.audit.list(id, user.sub, {
      limit: limit ? Number(limit) : undefined,
      before,
      action,
    });
  }
}
