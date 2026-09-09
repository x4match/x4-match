import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import {
  CreatePlatformOrderDto,
  CreatePlatformProductDto,
  CreatePlatformSponsorDto,
  UpdatePlatformProductDto,
} from './dto/platform-shop.dto';
import { PlatformShopService } from './platform-shop.service';

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

  @Get('orders')
  listOrders() {
    return this.platformShopService.listAllOrders();
  }
}
