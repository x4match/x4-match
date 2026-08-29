import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get(':id/messages')
  async getMessages(
    @Param('id') matchId: string,
    @CurrentUser() user: any,
  ) {
    return this.chatService.getMatchMessages(matchId, user.sub);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') matchId: string,
    @CurrentUser() user: any,
    @Body('content') content: string,
  ) {
    return this.chatService.createMessage(matchId, user.sub, content);
  }
}

