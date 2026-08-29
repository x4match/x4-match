import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateTournamentPhotoDto } from './dto/create-tournament-photo.dto';
import {
  CreateRegistrationDto,
  CreateTournamentDateDto,
  CreateTournamentDto,
  CreateTournamentInvitesDto,
  CreateTournamentMatchDto,
  GenerateFixtureDto,
  SetScoreDto,
  UpdateMatchDto,
  UpdateTournamentDto,
} from './dto/tournament-dtos';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // --- Rutas estáticas (deben ir antes de ':id') ---

  @Get()
  list() {
    return this.tournamentsService.list();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(
    @CurrentUser() user: { sub: string },
    @Query('status') status?: string,
  ) {
    return this.tournamentsService.listMine(user.sub, status);
  }

  @Get('join/:token')
  @UseGuards(JwtAuthGuard)
  joinByToken(@Param('token') token: string, @CurrentUser() user: { sub: string }) {
    return this.tournamentsService.joinByInviteToken(token, user.sub);
  }

  @Get('pay/mock')
  async mockPay(@Query('ref') ref: string, @Res() res: Response) {
    if (ref) await this.tournamentsService.approvePaymentByRef(ref);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Inscripción pagada (modo prueba)</h2>
        <p>Podés volver a la app de x4 match.</p>
      </body></html>`,
    );
  }

  @Get('pay/return')
  payReturn(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Pago recibido</h2><p>Volvé a la app para ver tu inscripción.</p></body></html>`,
    );
  }

  @Post('webhooks/mercadopago')
  webhook(@Body() body: Record<string, unknown>) {
    return this.tournamentsService.handleMercadoPagoWebhook(body as any);
  }

  // --- Torneos ---

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: { sub: string }, @Body() dto: CreateTournamentDto) {
    const created = await this.tournamentsService.create(user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated(created);
    return created;
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getById(
    @Param('id') id: string,
    @CurrentUser() user?: { sub: string },
    @Query('invite') inviteToken?: string,
  ) {
    return this.tournamentsService.getById(id, {
      userId: user?.sub,
      inviteToken: inviteToken ?? null,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateTournamentDto,
  ) {
    const updated = await this.tournamentsService.update(id, user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated(updated);
    return updated;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.tournamentsService.remove(id, user.sub);
  }

  // --- Validación de club ---

  @Post(':id/club-validation/approve')
  @UseGuards(JwtAuthGuard)
  async approveClubValidation(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    const updated = await this.tournamentsService.approveClubValidation(id, user.sub);
    this.realtimeGateway.emitTournamentUpdated(updated);
    return updated;
  }

  @Post(':id/club-validation/reject')
  @UseGuards(JwtAuthGuard)
  async rejectClubValidation(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    const updated = await this.tournamentsService.rejectClubValidation(id, user.sub);
    this.realtimeGateway.emitTournamentUpdated(updated);
    return updated;
  }

  // --- Invitaciones ---

  @Get(':id/invites')
  @UseGuards(JwtAuthGuard)
  listInvites(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.tournamentsService.listInvites(id, user.sub);
  }

  @Post(':id/invites')
  @UseGuards(JwtAuthGuard)
  createInvites(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateTournamentInvitesDto,
  ) {
    return this.tournamentsService.createInvites(id, user.sub, dto);
  }

  @Delete(':id/invites/:inviteId')
  @UseGuards(JwtAuthGuard)
  revokeInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.revokeInvite(id, inviteId, user.sub);
  }

  // --- Fechas ---

  @Get(':id/dates')
  listDates(@Param('id') id: string) {
    return this.tournamentsService.listDates(id);
  }

  @Post(':id/dates')
  @UseGuards(JwtAuthGuard)
  async addDate(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateTournamentDateDto,
  ) {
    const date = await this.tournamentsService.addDate(id, user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'date_added' });
    return date;
  }

  @Delete(':id/dates/:dateId')
  @UseGuards(JwtAuthGuard)
  removeDate(
    @Param('id') id: string,
    @Param('dateId') dateId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.removeDate(id, dateId, user.sub);
  }

  // --- Inscripciones ---

  @Get(':id/registrations')
  @UseGuards(OptionalJwtAuthGuard)
  registrations(
    @Param('id') id: string,
    @CurrentUser() user?: { sub: string },
    @Query('invite') inviteToken?: string,
  ) {
    return this.tournamentsService.listRegistrations(id, user?.sub, inviteToken);
  }

  @Get(':id/registrations/me')
  @UseGuards(JwtAuthGuard)
  myRegistration(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.tournamentsService.getMyRegistration(id, user.sub);
  }

  @Post(':id/registrations')
  @UseGuards(JwtAuthGuard)
  async register(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateRegistrationDto,
    @Query('invite') inviteToken?: string,
  ) {
    const reg = await this.tournamentsService.register(id, user.sub, dto, inviteToken);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'registration_added' });
    return reg;
  }

  @Post(':id/registrations/:regId/approve')
  @UseGuards(JwtAuthGuard)
  async approve(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: { sub: string },
  ) {
    const reg = await this.tournamentsService.approveRegistration(id, regId, user.sub);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'registration_approved' });
    return reg;
  }

  @Post(':id/registrations/:regId/reject')
  @UseGuards(JwtAuthGuard)
  reject(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.rejectRegistration(id, regId, user.sub);
  }

  @Delete(':id/registrations/:regId')
  @UseGuards(JwtAuthGuard)
  removeRegistration(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.removeRegistration(id, regId, user.sub);
  }

  // --- Pagos de inscripción ---

  @Post(':id/registrations/:regId/checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.createRegistrationCheckout(id, regId, user.sub);
  }

  @Post(':id/registrations/:regId/pay/simulate')
  @UseGuards(JwtAuthGuard)
  simulatePay(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.simulatePayment(id, regId, user.sub);
  }

  @Post(':id/registrations/:regId/mark-paid')
  @UseGuards(JwtAuthGuard)
  async markPaid(
    @Param('id') id: string,
    @Param('regId') regId: string,
    @CurrentUser() user: { sub: string },
  ) {
    const reg = await this.tournamentsService.markRegistrationPaid(id, regId, user.sub);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'registration_paid' });
    return reg;
  }

  // --- Partidos / Fixture ---

  @Get(':id/matches')
  @UseGuards(OptionalJwtAuthGuard)
  matches(
    @Param('id') id: string,
    @CurrentUser() user?: { sub: string },
    @Query('invite') inviteToken?: string,
  ) {
    return this.tournamentsService.listMatches(id, {
      userId: user?.sub,
      inviteToken,
    });
  }

  @Get(':id/fixture')
  @UseGuards(OptionalJwtAuthGuard)
  fixture(
    @Param('id') id: string,
    @CurrentUser() user?: { sub: string },
    @Query('invite') inviteToken?: string,
  ) {
    return this.tournamentsService.listMatches(id, {
      userId: user?.sub,
      inviteToken,
    });
  }

  @Get(':id/standings')
  @UseGuards(OptionalJwtAuthGuard)
  standings(
    @Param('id') id: string,
    @CurrentUser() user?: { sub: string },
    @Query('invite') inviteToken?: string,
  ) {
    return this.tournamentsService.getStandings(id, {
      userId: user?.sub,
      inviteToken,
    });
  }

  @Post(':id/matches')
  @UseGuards(JwtAuthGuard)
  async createMatch(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateTournamentMatchDto,
  ) {
    const match = await this.tournamentsService.createMatch(id, user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'match_created' });
    return match;
  }

  @Patch(':id/matches/:matchId')
  @UseGuards(JwtAuthGuard)
  async updateMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateMatchDto,
  ) {
    const match = await this.tournamentsService.updateMatch(id, matchId, user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'match_updated' });
    return match;
  }

  @Post(':id/matches/:matchId/score')
  @UseGuards(JwtAuthGuard)
  async setScore(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: SetScoreDto,
  ) {
    const match = await this.tournamentsService.setMatchScore(id, matchId, user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'score_updated' });
    return match;
  }

  @Delete(':id/matches/:matchId')
  @UseGuards(JwtAuthGuard)
  removeMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.removeMatch(id, matchId, user.sub);
  }

  @Post(':id/generate-fixture')
  @UseGuards(JwtAuthGuard)
  async generateFixture(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: GenerateFixtureDto,
  ) {
    const matches = await this.tournamentsService.generateFixture(id, user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'fixture_generated' });
    return matches;
  }

  // --- Fotos ---

  @Get(':id/photos')
  getPhotos(@Param('id') id: string) {
    return this.tournamentsService.listPhotos(id);
  }

  @Post(':id/photos')
  @UseGuards(JwtAuthGuard)
  async addPhoto(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateTournamentPhotoDto,
  ) {
    const photo = await this.tournamentsService.addPhoto(id, user.sub, dto);
    this.realtimeGateway.emitTournamentUpdated({ tournamentId: id, type: 'photo_added' });
    return photo;
  }

  @Delete(':id/photos/:photoId')
  @UseGuards(JwtAuthGuard)
  deletePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.deletePhoto(id, photoId, user.sub);
  }
}
