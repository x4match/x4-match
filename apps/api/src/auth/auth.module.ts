import { Module } from '@nestjs/common';
import { FejubaModule } from '../integrations/fejuba/fejuba.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  imports: [FejubaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
