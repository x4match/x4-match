import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { TournamentsService } from '../tournaments/tournaments.service';
import { ClubCommentsService } from './club-comments.service';
import { ClubGapFillService } from './club-gap-fill.service';
import { ClubManagerService } from './club-manager.service';
import { ClubPaymentConfigService } from './club-payment-config.service';
import { ClubTrialService } from './club-trial.service';
import { ClubsService } from './clubs.service';
import { CreateClubCommentDto } from './dto/create-club-comment.dto';
import { CreateClubDto } from './dto/create-club.dto';
import { CreateClubPromotionDto } from './dto/create-club-promotion.dto';
import { CreateClubRewardDto } from './dto/create-club-reward.dto';
import { UpdateClubRewardDto } from './dto/update-club-reward.dto';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreateCourtScheduleDto } from './dto/create-court-schedule.dto';
import { CreateCourtSlotDto } from './dto/create-court-slot.dto';
import { CreateShopCouponDto } from './dto/create-shop-coupon.dto';
import { CreateShopProductDto } from './dto/create-shop-product.dto';
import { GenerateCourtSlotsDto } from './dto/generate-court-slots.dto';
import { UpdateShopProductDto } from './dto/update-shop-product.dto';
import { UpdateAutoFillGapsDto } from './dto/update-auto-fill-gaps.dto';
import { NotifyClubSegmentDto } from './dto/notify-club-segment.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { UpdateCourtScheduleDto } from './dto/update-court-schedule.dto';
import { UpdateCourtSlotDto } from './dto/update-court-slot.dto';
import { UpdateShopStockDto } from './dto/update-shop-stock.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { UpdateClubPaymentModeDto } from './dto/update-club-payment-mode.dto';

@Controller('clubs')
export class ClubsController {
  constructor(
    private readonly clubsService: ClubsService,
    private readonly clubCommentsService: ClubCommentsService,
    private readonly clubGapFillService: ClubGapFillService,
    private readonly clubManagerService: ClubManagerService,
    private readonly clubPaymentConfigService: ClubPaymentConfigService,
    private readonly clubTrialService: ClubTrialService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@CurrentUser() user?: { sub?: string }) {
    return this.clubsService.findAllForViewer(user?.sub);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: { sub: string }) {
    return this.clubsService.findMine(user.sub);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  findAvailable(
    @Query('date') date?: string,
    @Query('startHour') startHour?: string,
    @Query('endHour') endHour?: string,
  ) {
    return this.clubsService.findAvailableForWindow(
      date ?? '',
      startHour != null ? Number(startHour) : NaN,
      endHour != null ? Number(endHour) : NaN,
    );
  }

  @Get('oauth/mercadopago/callback')
  async mercadoPagoOAuthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.clubPaymentConfigService.handleOAuthCallback(
      code,
      state,
      error,
    );
    // Web: redirect HTTP. Mobile: HTML puente (Safari no abre bien x4match:// vía 302).
    if (result.returnTo === 'web') {
      return res.redirect(result.url);
    }
    const html = this.clubPaymentConfigService.buildOAuthBridgeHtml(result);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  @Get(':id/payments/status')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    await this.clubsService.requireClubAdmin(id, user.sub);
    return this.clubPaymentConfigService.getStatus(id);
  }

  @Post(':id/payments/oauth/start')
  @UseGuards(JwtAuthGuard)
  async startPaymentOAuth(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() body?: { returnTo?: 'web' | 'mobile' },
  ) {
    await this.clubsService.requireClubAdmin(id, user.sub);
    return this.clubPaymentConfigService.startOAuth(id, user.sub, body?.returnTo);
  }

  @Post(':id/payments/mock-connect')
  @UseGuards(JwtAuthGuard)
  async mockConnectPayments(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    await this.clubsService.requireClubAdmin(id, user.sub);
    return this.clubPaymentConfigService.mockConnect(id);
  }

  @Patch(':id/payments/mode')
  @UseGuards(JwtAuthGuard)
  async updatePaymentMode(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateClubPaymentModeDto,
  ) {
    await this.clubsService.requireClubAdmin(id, user.sub);
    return this.clubPaymentConfigService.setPaymentMode(id, dto.mode);
  }

  @Delete(':id/payments/disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectPayments(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    await this.clubsService.requireClubAdmin(id, user.sub);
    return this.clubPaymentConfigService.disconnect(id);
  }

  @Get(':id/trial')
  @UseGuards(JwtAuthGuard)
  async getClubTrial(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    await this.clubsService.requireClubAdmin(id, user.sub);
    return this.clubTrialService.getTrialStatus(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clubsService.findOne(id);
  }

  @Get(':id/tournament-validations')
  @UseGuards(JwtAuthGuard)
  listTournamentValidations(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tournamentsService.listPendingClubValidations(id, user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateClubDto) {
    return this.clubsService.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateClubDto,
  ) {
    return this.clubsService.update(user.sub, id, dto);
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
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }
    return this.clubsService.uploadLogo(user.sub, id, file);
  }

  @Post(':id/cover')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('cover', {
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
  uploadCover(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }
    return this.clubsService.uploadCover(user.sub, id, file);
  }

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard)
  getDashboard(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.getDashboard(id, user.sub);
  }

  @Get(':id/manager-report')
  @UseGuards(JwtAuthGuard)
  getManagerReport(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Query('days') days?: string,
  ) {
    const periodDays = days != null ? parseInt(days, 10) : 30;
    return this.clubManagerService.getManagerReport(
      id,
      user.sub,
      Number.isFinite(periodDays) ? periodDays : 30,
    );
  }

  @Get(':id/demand-insights')
  @UseGuards(JwtAuthGuard)
  async getDemandInsights(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    await this.clubsService.requireClubAdmin(id, user.sub);
    return this.clubGapFillService.getDemandInsights(id);
  }

  @Patch(':id/auto-fill-gaps')
  @UseGuards(JwtAuthGuard)
  setAutoFillGaps(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateAutoFillGapsDto,
  ) {
    return this.clubsService.setAutoFillGaps(id, user.sub, {
      enabled: dto.enabled,
      hoursBefore: dto.hoursBefore,
      autoCreateMatch: dto.autoCreateMatch,
      notifyEnabled: dto.notifyEnabled,
    });
  }

  @Post(':id/segments/notify')
  @UseGuards(JwtAuthGuard)
  notifySegment(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: NotifyClubSegmentDto,
  ) {
    return this.clubManagerService.notifySegment(id, user.sub, dto);
  }

  @Get(':id/impact')
  @UseGuards(JwtAuthGuard)
  getImpact(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.getClubImpact(id, user.sub);
  }

  @Get(':id/leaderboard')
  getLeaderboard(@Param('id') id: string, @Query('month') month?: string) {
    return this.clubsService.getPublicLeaderboard(id, 20, month);
  }

  @Get(':id/rewards-catalog')
  getRewardsCatalog(@Param('id') id: string) {
    return this.clubsService.getPublicRewards(id);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.clubCommentsService.list(id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  createComment(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateClubCommentDto,
  ) {
    return this.clubCommentsService.create(id, user.sub, dto);
  }

  @Get(':id/my-points')
  @UseGuards(JwtAuthGuard)
  getMyPoints(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Query('month') month?: string,
  ) {
    return this.clubsService.getMyClubPoints(id, user.sub, month);
  }

  @Post(':id/rewards/:rewardId/redeem')
  @UseGuards(JwtAuthGuard)
  redeemReward(
    @Param('id') id: string,
    @Param('rewardId') rewardId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.redeemReward(id, user.sub, rewardId);
  }

  @Get(':id/revenue')
  @UseGuards(JwtAuthGuard)
  getRevenue(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Query('days') days?: string,
    @Query('movementsLimit') movementsLimit?: string,
  ) {
    const periodDays = days != null ? parseInt(days, 10) : 30;
    const parsedMovementsLimit =
      movementsLimit != null ? parseInt(movementsLimit, 10) : 15;
    return this.clubsService.getRevenue(
      id,
      user.sub,
      Number.isFinite(periodDays) ? periodDays : 30,
      Number.isFinite(parsedMovementsLimit) ? parsedMovementsLimit : 15,
    );
  }

  @Get(':id/rankings')
  @UseGuards(JwtAuthGuard)
  getRankings(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Query('period') period?: 'weekly' | 'monthly' | 'annual',
    @Query('month') month?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = parseInt(limit || '20', 10);
    const safePeriod = period === 'weekly' || period === 'annual' ? period : 'monthly';
    return this.clubsService.getInternalRanking(
      id,
      user.sub,
      safePeriod,
      month,
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }

  @Get(':id/promotions')
  @UseGuards(JwtAuthGuard)
  listPromotions(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listPromotions(id, user.sub);
  }

  @Post(':id/promotions')
  @UseGuards(JwtAuthGuard)
  createPromotion(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateClubPromotionDto,
  ) {
    return this.clubsService.createPromotion(id, user.sub, dto);
  }

  @Delete(':id/promotions/:promotionId')
  @UseGuards(JwtAuthGuard)
  deletePromotion(
    @Param('id') id: string,
    @Param('promotionId') promotionId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.deletePromotion(id, user.sub, promotionId);
  }

  @Get(':id/rewards')
  @UseGuards(JwtAuthGuard)
  listRewards(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listRewards(id, user.sub);
  }

  @Post(':id/rewards')
  @UseGuards(JwtAuthGuard)
  createReward(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateClubRewardDto,
  ) {
    return this.clubsService.createReward(id, user.sub, dto);
  }

  @Get(':id/rewards/redemptions')
  @UseGuards(JwtAuthGuard)
  listRewardRedemptions(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listRewardRedemptions(id, user.sub);
  }

  @Patch(':id/rewards/:rewardId')
  @UseGuards(JwtAuthGuard)
  updateReward(
    @Param('id') id: string,
    @Param('rewardId') rewardId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateClubRewardDto,
  ) {
    return this.clubsService.updateReward(id, user.sub, rewardId, dto);
  }

  @Get(':id/shop/products/manage')
  @UseGuards(JwtAuthGuard)
  listShopProductsManage(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listShopProductsManage(id, user.sub);
  }

  @Get(':id/shop/products')
  listShopProducts(
    @Param('id') id: string,
    @Query('kind') kind?: string,
    @Query('matchExtra') matchExtra?: string,
  ) {
    const matchExtraOnly = matchExtra === 'true' || matchExtra === '1' || kind === 'MATCH_ADDON';
    return this.clubsService.listShopProducts(id, { matchExtraOnly });
  }

  @Post(':id/shop/products')
  @UseGuards(JwtAuthGuard)
  createShopProduct(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateShopProductDto,
  ) {
    return this.clubsService.createShopProduct(id, user.sub, dto);
  }

  @Patch(':id/shop/products/:productId')
  @UseGuards(JwtAuthGuard)
  updateShopProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateShopProductDto,
  ) {
    return this.clubsService.updateShopProduct(id, user.sub, productId, dto);
  }

  @Patch(':id/shop/products/:productId/stock')
  @UseGuards(JwtAuthGuard)
  updateShopProductStock(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateShopStockDto,
  ) {
    return this.clubsService.updateShopProductStock(id, user.sub, productId, dto);
  }

  @Delete(':id/shop/products/:productId')
  @UseGuards(JwtAuthGuard)
  deactivateShopProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.deactivateShopProduct(id, user.sub, productId);
  }

  @Post(':id/shop/products/:productId/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
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
  uploadShopProductPhoto(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }
    return this.clubsService.uploadShopProductPhoto(id, user.sub, productId, file);
  }

  @Post(':id/shop/purchases/:purchaseId/confirm')
  @UseGuards(JwtAuthGuard)
  confirmShopPurchase(
    @Param('id') id: string,
    @Param('purchaseId') purchaseId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.confirmShopPurchase(id, user.sub, purchaseId);
  }

  @Post(':id/deposits/:depositId/mark-paid')
  @UseGuards(JwtAuthGuard)
  markDepositPaid(
    @Param('id') id: string,
    @Param('depositId') depositId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.markDepositPaid(id, user.sub, depositId);
  }

  @Get(':id/shop/sales')
  @UseGuards(JwtAuthGuard)
  listShopSales(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listShopSales(id, user.sub);
  }

  @Get(':id/shop/stats')
  @UseGuards(JwtAuthGuard)
  getShopStats(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Query('days') days?: string,
  ) {
    return this.clubsService.getShopStats(id, user.sub, days ? Number(days) : 30);
  }

  @Get(':id/shop/coupons')
  @UseGuards(JwtAuthGuard)
  listShopCoupons(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listShopCoupons(id, user.sub);
  }

  @Post(':id/shop/coupons')
  @UseGuards(JwtAuthGuard)
  createShopCoupon(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateShopCouponDto,
  ) {
    return this.clubsService.createShopCoupon(id, user.sub, dto);
  }

  @Delete(':id/shop/coupons/:couponId')
  @UseGuards(JwtAuthGuard)
  deactivateShopCoupon(
    @Param('id') id: string,
    @Param('couponId') couponId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.deactivateShopCoupon(id, user.sub, couponId);
  }

  @Get(':id/court-slots')
  @UseGuards(JwtAuthGuard)
  listCourtSlots(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listCourtSlots(id, user.sub);
  }

  @Get(':id/courts')
  @UseGuards(JwtAuthGuard)
  listCourts(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listCourts(id, user.sub);
  }

  @Post(':id/courts')
  @UseGuards(JwtAuthGuard)
  createCourt(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCourtDto,
  ) {
    return this.clubsService.createCourt(id, user.sub, dto);
  }

  @Patch(':id/courts/:courtId')
  @UseGuards(JwtAuthGuard)
  updateCourt(
    @Param('id') id: string,
    @Param('courtId') courtId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateCourtDto,
  ) {
    return this.clubsService.updateCourt(id, user.sub, courtId, dto);
  }

  @Delete(':id/courts/:courtId')
  @UseGuards(JwtAuthGuard)
  deleteCourt(
    @Param('id') id: string,
    @Param('courtId') courtId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.deleteCourt(id, user.sub, courtId);
  }

  @Get(':id/courts/:courtId/schedules')
  @UseGuards(JwtAuthGuard)
  listCourtSchedules(
    @Param('id') id: string,
    @Param('courtId') courtId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.listCourtSchedules(id, user.sub, courtId);
  }

  @Post(':id/courts/:courtId/schedules')
  @UseGuards(JwtAuthGuard)
  createCourtSchedule(
    @Param('id') id: string,
    @Param('courtId') courtId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCourtScheduleDto,
  ) {
    return this.clubsService.createCourtSchedule(id, user.sub, courtId, dto);
  }

  @Patch(':id/courts/:courtId/schedules/:scheduleId')
  @UseGuards(JwtAuthGuard)
  updateCourtSchedule(
    @Param('id') id: string,
    @Param('courtId') courtId: string,
    @Param('scheduleId') scheduleId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateCourtScheduleDto,
  ) {
    return this.clubsService.updateCourtSchedule(id, user.sub, courtId, scheduleId, dto);
  }

  @Delete(':id/courts/:courtId/schedules/:scheduleId')
  @UseGuards(JwtAuthGuard)
  deleteCourtSchedule(
    @Param('id') id: string,
    @Param('courtId') courtId: string,
    @Param('scheduleId') scheduleId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.deleteCourtSchedule(id, user.sub, courtId, scheduleId);
  }

  @Post(':id/courts/:courtId/generate-slots')
  @UseGuards(JwtAuthGuard)
  generateCourtSlots(
    @Param('id') id: string,
    @Param('courtId') courtId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: GenerateCourtSlotsDto,
  ) {
    return this.clubsService.generateSlotsFromSchedules(id, user.sub, courtId, dto);
  }

  @Get(':id/matches')
  @UseGuards(JwtAuthGuard)
  listClubMatches(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.clubsService.listClubMatches(id, user.sub);
  }

  @Post(':id/court-slots')
  @UseGuards(JwtAuthGuard)
  createCourtSlot(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCourtSlotDto,
  ) {
    return this.clubsService.createCourtSlot(user.sub, id, dto);
  }

  @Patch(':id/court-slots/:slotId')
  @UseGuards(JwtAuthGuard)
  updateCourtSlot(
    @Param('id') id: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateCourtSlotDto,
  ) {
    return this.clubsService.updateCourtSlot(user.sub, id, slotId, dto);
  }

  @Delete(':id/court-slots/:slotId')
  @UseGuards(JwtAuthGuard)
  deleteCourtSlot(
    @Param('id') id: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.clubsService.deleteCourtSlot(user.sub, id, slotId);
  }
}
