import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.listForUser(user.sub);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.markRead(user.sub, id);
  }
}
