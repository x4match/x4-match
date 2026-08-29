import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [MatchesModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
