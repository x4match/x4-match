import { Module } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { PlayerMarketplaceController } from './player-marketplace.controller';
import { PlayerMarketplaceService } from './player-marketplace.service';

@Module({
  controllers: [PlayerMarketplaceController],
  providers: [PlayerMarketplaceService, OptionalJwtAuthGuard],
})
export class PlayerMarketplaceModule {}
