import { Module, forwardRef } from '@nestjs/common';
import { ClubsModule } from '../clubs/clubs.module';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [forwardRef(() => ClubsModule)],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
