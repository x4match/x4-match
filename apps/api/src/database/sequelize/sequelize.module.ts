import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeService } from './sequelize.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SequelizeService],
  exports: [SequelizeService],
})
export class SequelizeModule {}
