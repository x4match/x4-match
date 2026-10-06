import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { BracketService } from './bracket.service';

@Module({
  imports: [NotificationsModule],
  providers: [BracketService],
  exports: [BracketService],
})
export class BracketsModule {}
