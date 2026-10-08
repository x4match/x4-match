import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('match:watch')
  watchMatch(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId?: string }) {
    if (typeof data?.matchId !== 'string' || !data.matchId) return;
    client.join(`match:${data.matchId}`);
  }

  @SubscribeMessage('match:unwatch')
  unwatchMatch(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId?: string }) {
    if (typeof data?.matchId !== 'string' || !data.matchId) return;
    client.leave(`match:${data.matchId}`);
  }

  emitMatchJoined(payload: unknown) {
    this.server.emit('match:joined', payload);
  }

  emitMatchLeft(payload: unknown) {
    this.server.emit('match:left', payload);
  }

  emitMatchUpdated(payload: unknown) {
    this.server.emit('match:updated', payload);
  }

  emitTournamentUpdated(payload: unknown) {
    this.server.emit('tournament:updated', payload);
  }

  emitCircuitEventUpdated(payload: unknown) {
    this.server.emit('circuit_event:updated', payload);
  }

  emitMatchScoreUpdated(payload: unknown) {
    this.server.emit('match:score_updated', payload);
  }

  emitMatchLiveScore(matchId: string, payload: unknown) {
    this.server?.to(`match:${matchId}`).emit('match:live_score', payload);
  }

  emitNewMessage(matchId: string, payload: unknown) {
    this.server.to(`match:${matchId}`).emit('chat:new_message', payload);
  }
}
