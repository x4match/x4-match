import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import {
  AddSponsorMemberDto,
  CreateCategoryDto,
  CreateCouponDto,
  CreatePlatformOrderDto,
  CreatePlatformProductDto,
  CreatePlatformSponsorDto,
  CreateShippingMethodDto,
  SetSponsorDomainDto,
  ShippingQuoteDto,
  SponsorCheckoutDto,
  SponsorCustomerAuthDto,
  UpdateCategoryDto,
  UpdateOrderStatusDto,
  UpdatePlatformProductDto,
  UpdatePlatformSponsorDto,
  UpdateShippingMethodDto,
  UpdateWhatsappPaymentDto,
} from './dto/platform-shop.dto';
import { PlatformShopService } from './platform-shop.service';
import { SponsorMemberGuard } from './sponsor-member.guard';
import { SponsorPaymentsService } from './sponsor-payments.service';

@Controller('shop')
export class PlatformShopController {
  constructor(private readonly platformShopService: PlatformShopService) {}

  @Get('products')
  listProducts() {
    return this.platformShopService.listActiveProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.platformShopService.getProduct(id);
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(@CurrentUser() user: { sub: string }, @Body() dto: CreatePlatformOrderDto) {
    return this.platformShopService.createOrder(user.sub, dto);
  }

  @Get('orders/me')
  @UseGuards(JwtAuthGuard)
  myOrders(@CurrentUser() user: { sub: string }) {
    return this.platformShopService.listMyOrders(user.sub);
  }

  @Post('orders/:id/pay/simulate')
  @UseGuards(JwtAuthGuard)
  simulatePay(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.platformShopService.simulatePay(id, user.sub);
  }
}

@Controller('sponsors')
export class SponsorsPublicController {
  constructor(
    private readonly shop: PlatformShopService,
    private readonly payments: SponsorPaymentsService,
  ) {}

  @Get('resolve')
  resolve(@Query('host') host: string) {
    return this.shop.resolveByHost(host || '');
  }

  @Get('oauth/mercadopago/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const result = await this.payments.handleOAuthCallback(code, state, error);
    return res.redirect(result.url);
  }

  @Post('webhooks/mercadopago')
  webhook(@Body() body: any) {
    return this.payments.handleMercadoPagoWebhook(body);
  }

  @Get(':slug')
  getStore(@Param('slug') slug: string) {
    return this.shop.getSponsorBySlug(slug);
  }

  @Get(':slug/categories')
  categories(@Param('slug') slug: string) {
    return this.shop.listCategories(slug, true);
  }

  @Get(':slug/products')
  products(
    @Param('slug') slug: string,
    @Query('category') category?: string,
    @Query('offers') offers?: string,
  ) {
    return this.shop.listStoreProducts(slug, {
      category,
      offers: offers === '1' || offers === 'true',
    });
  }

  @Get(':slug/products/:id')
  product(@Param('slug') slug: string, @Param('id') id: string) {
    return this.shop.getStoreProduct(slug, id);
  }

  @Post(':slug/shipping/quote')
  quote(@Param('slug') slug: string, @Body() dto: ShippingQuoteDto) {
    return this.shop.quoteShipping(slug, dto);
  }

  @Post(':slug/checkout')
  checkout(
    @Param('slug') slug: string,
    @Body() dto: SponsorCheckoutDto,
    @Headers('x-sponsor-customer-token') customerToken?: string,
  ) {
    // customer id extracted loosely via optional header decoded elsewhere — MVP guest-first
    void customerToken;
    return this.shop.checkout(slug, dto);
  }

  @Get(':slug/orders/:id')
  order(@Param('slug') slug: string, @Param('id') id: string) {
    return this.shop.getStoreOrder(slug, id);
  }

  @Post(':slug/auth/register')
  register(@Param('slug') slug: string, @Body() dto: SponsorCustomerAuthDto) {
    return this.shop.registerCustomer(slug, dto);
  }

  @Post(':slug/auth/login')
  login(@Param('slug') slug: string, @Body() dto: SponsorCustomerAuthDto) {
    return this.shop.loginCustomer(slug, dto);
  }
}

@Controller('sponsors/me')
@UseGuards(JwtAuthGuard, SponsorMemberGuard)
export class SponsorsPartnerController {
  constructor(
    private readonly shop: PlatformShopService,
    private readonly payments: SponsorPaymentsService,
  ) {}

  @Get()
  listMine(@CurrentUser() user: { sub: string }) {
    return this.shop.listMySponsors(user.sub);
  }

  @Get(':sponsorId')
  getOne(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.getMySponsor(user.sub, sponsorId);
  }

  @Patch(':sponsorId')
  update(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Body() dto: UpdatePlatformSponsorDto,
  ) {
    return this.shop.updateMySponsor(user.sub, sponsorId, dto);
  }

  @Get(':sponsorId/products')
  products(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.listSponsorProducts(sponsorId),
    );
  }

  @Post(':sponsorId/products')
  createProduct(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Body() dto: CreatePlatformProductDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.createProduct({ ...dto, sponsorId }),
    );
  }

  @Patch(':sponsorId/products/:productId')
  updateProduct(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdatePlatformProductDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.updateProduct(productId, { ...dto, sponsorId }),
    );
  }

  @Delete(':sponsorId/products/:productId')
  deleteProduct(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('productId') productId: string,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.deleteProduct(productId),
    );
  }

  @Get(':sponsorId/categories')
  categories(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(async () => {
      const sponsor = await this.shop.getMySponsor(user.sub, sponsorId);
      return this.shop.listCategories(sponsor.slug, false);
    });
  }

  @Post(':sponsorId/categories')
  createCategory(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.createCategory(sponsorId, dto),
    );
  }

  @Patch(':sponsorId/categories/:categoryId')
  updateCategory(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.updateCategory(sponsorId, categoryId, dto),
    );
  }

  @Delete(':sponsorId/categories/:categoryId')
  deleteCategory(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.deleteCategory(sponsorId, categoryId),
    );
  }

  @Get(':sponsorId/coupons')
  coupons(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.listCoupons(sponsorId),
    );
  }

  @Post(':sponsorId/coupons')
  createCoupon(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Body() dto: CreateCouponDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.createCoupon(sponsorId, dto),
    );
  }

  @Delete(':sponsorId/coupons/:couponId')
  deactivateCoupon(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('couponId') couponId: string,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.deactivateCoupon(sponsorId, couponId),
    );
  }

  @Get(':sponsorId/shipping')
  shipping(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.listShippingMethods(sponsorId),
    );
  }

  @Post(':sponsorId/shipping')
  createShipping(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Body() dto: CreateShippingMethodDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.createShippingMethod(sponsorId, dto),
    );
  }

  @Patch(':sponsorId/shipping/:methodId')
  updateShipping(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('methodId') methodId: string,
    @Body() dto: UpdateShippingMethodDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.updateShippingMethod(sponsorId, methodId, dto),
    );
  }

  @Delete(':sponsorId/shipping/:methodId')
  deleteShipping(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('methodId') methodId: string,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.deleteShippingMethod(sponsorId, methodId),
    );
  }

  @Get(':sponsorId/orders')
  orders(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.listSponsorOrders(sponsorId),
    );
  }

  @Patch(':sponsorId/orders/:orderId/status')
  updateOrderStatus(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.updateOrderStatus(sponsorId, orderId, dto),
    );
  }

  @Get(':sponsorId/payments/status')
  paymentStatus(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.payments.getStatus(sponsorId),
    );
  }

  @Post(':sponsorId/payments/mercadopago/connect')
  connectMp(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.payments.startOAuth(sponsorId, user.sub),
    );
  }

  @Post(':sponsorId/payments/mercadopago/disconnect')
  disconnectMp(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.payments.disconnectMp(sponsorId),
    );
  }

  @Patch(':sponsorId/payments/whatsapp')
  whatsapp(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Body() dto: UpdateWhatsappPaymentDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.payments.updateWhatsapp(sponsorId, dto),
    );
  }

  @Post(':sponsorId/domain')
  setDomain(
    @CurrentUser() user: { sub: string },
    @Param('sponsorId') sponsorId: string,
    @Body() dto: SetSponsorDomainDto,
  ) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.setDomain(sponsorId, dto),
    );
  }

  @Post(':sponsorId/domain/verify')
  verifyDomain(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.verifyDomain(sponsorId),
    );
  }

  @Delete(':sponsorId/domain')
  removeDomain(@CurrentUser() user: { sub: string }, @Param('sponsorId') sponsorId: string) {
    return this.shop.assertMember(user.sub, sponsorId).then(() =>
      this.shop.removeDomain(sponsorId),
    );
  }
}

@Controller('platform/shop')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformShopAdminController {
  constructor(private readonly platformShopService: PlatformShopService) {}

  @Get('products')
  listAllProducts() {
    return this.platformShopService.listAllProducts();
  }

  @Post('products')
  createProduct(@Body() dto: CreatePlatformProductDto) {
    return this.platformShopService.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdatePlatformProductDto) {
    return this.platformShopService.updateProduct(id, dto);
  }

  @Get('sponsors')
  listSponsors() {
    return this.platformShopService.listSponsors();
  }

  @Post('sponsors')
  createSponsor(@Body() dto: CreatePlatformSponsorDto) {
    return this.platformShopService.createSponsor(dto);
  }

  @Patch('sponsors/:id')
  updateSponsor(@Param('id') id: string, @Body() dto: UpdatePlatformSponsorDto) {
    return this.platformShopService.updateSponsor(id, dto);
  }

  @Get('sponsors/:id/members')
  listMembers(@Param('id') id: string) {
    return this.platformShopService.listMembers(id);
  }

  @Post('sponsors/:id/members')
  addMember(@Param('id') id: string, @Body() dto: AddSponsorMemberDto) {
    return this.platformShopService.addMember(id, dto);
  }

  @Delete('sponsors/:id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.platformShopService.removeMember(id, userId);
  }

  @Post('sponsors/:id/domain')
  setDomain(@Param('id') id: string, @Body() dto: SetSponsorDomainDto) {
    return this.platformShopService.setDomain(id, dto);
  }

  @Post('sponsors/:id/domain/verify')
  verifyDomain(@Param('id') id: string) {
    return this.platformShopService.verifyDomain(id);
  }

  @Delete('sponsors/:id/domain')
  removeDomain(@Param('id') id: string) {
    return this.platformShopService.removeDomain(id);
  }

  @Get('sponsors/:id/orders')
  sponsorOrders(@Param('id') id: string) {
    return this.platformShopService.listSponsorOrders(id);
  }

  @Get('orders')
  listOrders() {
    return this.platformShopService.listAllOrders();
  }
}
