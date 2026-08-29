import { Module } from '@nestjs/common';
import { CompetitiveScoringController } from './competitive-scoring.controller';
import { CompetitiveScoringService } from './competitive-scoring.service';

@Module({
  controllers: [CompetitiveScoringController],
  providers: [CompetitiveScoringService],
  exports: [CompetitiveScoringService],
})
export class CompetitiveScoringModule {}
