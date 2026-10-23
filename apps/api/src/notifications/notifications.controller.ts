import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.listForUser(user.sub);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.sub, dto);
  }

  @Get('muted-clubs')
  listMutedClubs(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.listMutedClubs(user.sub);
  }

  @Put('muted-clubs/:clubId')
  muteClub(@CurrentUser() user: { sub: string }, @Param('clubId', ParseUUIDPipe) clubId: string) {
    return this.notificationsService.muteClub(user.sub, clubId);
  }

  @Delete('muted-clubs/:clubId')
  unmuteClub(@CurrentUser() user: { sub: string }, @Param('clubId', ParseUUIDPipe) clubId: string) {
    return this.notificationsService.unmuteClub(user.sub, clubId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Post('push-token')
  registerPushToken(
    @CurrentUser() user: { sub: string },
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(user.sub, dto.token, dto.platform);
  }

  @Delete('push-token')
  unregisterPushToken(
    @CurrentUser() user: { sub: string },
    @Query('token') token?: string,
  ) {
    return this.notificationsService.unregisterPushToken(user.sub, token);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.markRead(user.sub, id);
  }

  @Delete()
  removeAll(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.removeAll(user.sub);
  }

  // Después de `push-token` para que no lo capture como id.
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.remove(user.sub, id);
  }
}
