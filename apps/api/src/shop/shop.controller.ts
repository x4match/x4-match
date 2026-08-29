import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AddShopPurchaseDto } from './dto/add-shop-purchase.dto';
import { CheckoutShopDto } from './dto/checkout-shop.dto';
import { CreateShopProductDto } from './dto/create-shop-product.dto';
import { UpdateShopProductDto } from './dto/update-shop-product.dto';
import { ShopService } from './shop.service';

@Controller('clubs/:clubId/shop')
export class ClubShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('products')
  listProducts(@Param('clubId') clubId: string, @Query('kind') kind?: string) {
    return this.shopService.listProducts(clubId, kind);
  }

  @Get('products/manage')
  @UseGuards(JwtAuthGuard)
  listProductsAdmin(@Param('clubId') clubId: string, @CurrentUser() user: { sub: string }) {
    return this.shopService.listProductsForClubAdmin(clubId, user.sub);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard)
  createProduct(
    @Param('clubId') clubId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateShopProductDto,
  ) {
    return this.shopService.createProduct(clubId, user.sub, dto);
  }

  @Patch('products/:productId')
  @UseGuards(JwtAuthGuard)
  updateProduct(
    @Param('clubId') clubId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateShopProductDto,
  ) {
    return this.shopService.updateProduct(clubId, user.sub, productId, dto);
  }

  @Delete('products/:productId')
  @UseGuards(JwtAuthGuard)
  deactivateProduct(
    @Param('clubId') clubId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.shopService.deactivateProduct(clubId, user.sub, productId);
  }

  @Get('sales')
  @UseGuards(JwtAuthGuard)
  listSales(@Param('clubId') clubId: string, @CurrentUser() user: { sub: string }) {
    return this.shopService.listClubSales(clubId, user.sub);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @Param('clubId') clubId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CheckoutShopDto,
  ) {
    return this.shopService.checkout(clubId, user.sub, dto);
  }
}

@Controller('matches/:matchId/shop')
export class MatchShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get()
  listMatchShop(@Param('matchId') matchId: string) {
    return this.shopService.listMatchPurchases(matchId);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  addItem(
    @Param('matchId') matchId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: AddShopPurchaseDto,
  ) {
    return this.shopService.addMatchPurchase(matchId, user.sub, dto);
  }

  @Delete('items/:purchaseId')
  @UseGuards(JwtAuthGuard)
  removeItem(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.shopService.removePurchase(purchaseId, user.sub);
  }
}
