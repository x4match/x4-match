import { Module } from '@nestjs/common';
import { FejubaService } from './fejuba.service';

@Module({
  providers: [FejubaService],
  exports: [FejubaService],
})
export class FejubaModule {}
