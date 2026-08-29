import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MessagingService } from './messaging.service';
import { SendDmDto } from './dto/send-dm.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.messagingService.listConversations(user.sub);
  }

  @Get('pending')
  listPending(@CurrentUser() user: { sub: string }) {
    return this.messagingService.listPendingRequests(user.sub);
  }

  @Get('access/:userId')
  async getAccess(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    const otherUserId = await this.messagingService.resolveUserIdFromPlayer(userId);
    return this.messagingService.getAccess(user.sub, otherUserId);
  }

  @Post('request/:userId')
  async request(
    @CurrentUser() user: { sub: string },
    @Param('userId') userId: string,
  ) {
    const otherUserId = await this.messagingService.resolveUserIdFromPlayer(userId);
    return this.messagingService.requestConversation(user.sub, otherUserId);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.messagingService.acceptConversation(user.sub, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.messagingService.rejectConversation(user.sub, id);
  }

  @Get(':id/messages')
  getMessages(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.messagingService.getMessages(user.sub, id);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: SendDmDto,
  ) {
    return this.messagingService.sendMessage(user.sub, id, dto.content);
  }
}
