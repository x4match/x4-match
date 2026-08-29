import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Cleanup si es necesario
  }

  @SubscribeMessage('join_match')
  async handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    try {
      const userId = client.data.userId;
      const match = await this.prisma.match.findUnique({
        where: { id: data.matchId },
        include: {
          participants: {
            where: { userId },
          },
        },
      });

      if (!match || match.participants.length === 0) {
        client.emit('error', { message: 'No tenés acceso a este chat' });
        return;
      }

      // Solo permitir chat en partidos confirmados o completados
      if (!['CONFIRMED', 'COMPLETED'].includes(match.status)) {
        client.emit('error', { message: 'El chat solo está disponible para partidos confirmados' });
        return;
      }

      client.join(`match:${data.matchId}`);
      client.emit('joined', { matchId: data.matchId });
    } catch (error) {
      client.emit('error', { message: 'Error al unirse al chat' });
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; content: string },
  ) {
    try {
      const userId = client.data.userId;
      const message = await this.chatService.createMessage(
        data.matchId,
        userId,
        data.content,
      );

      this.server.to(`match:${data.matchId}`).emit('new_message', message);
    } catch (error) {
      client.emit('error', { message: 'Error al enviar mensaje' });
    }
  }
}

