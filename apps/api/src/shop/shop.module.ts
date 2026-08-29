import { Module } from '@nestjs/common';
import { ClubShopController, MatchShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  controllers: [ClubShopController, MatchShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
