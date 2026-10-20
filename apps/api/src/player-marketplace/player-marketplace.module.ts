import { Module } from '@nestjs/common';
import { PlayerMarketplaceController } from './player-marketplace.controller';

@Module({
  controllers: [PlayerMarketplaceController],
})
export class PlayerMarketplaceModule {}
