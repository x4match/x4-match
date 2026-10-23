import { Module } from '@nestjs/common';
import { ClubsModule } from '../clubs/clubs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { PlatformNewsController } from './platform-news.controller';

@Module({
  imports: [ClubsModule, NotificationsModule],
  controllers: [NewsController, PlatformNewsController],
  providers: [NewsService, OptionalJwtAuthGuard, PlatformAdminGuard],
})
export class NewsModule {}
