import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server: Server;

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

  emitMatchScoreUpdated(payload: unknown) {
    this.server.emit('match:score_updated', payload);
  }

  emitNewMessage(matchId: string, payload: unknown) {
    this.server.to(`match:${matchId}`).emit('chat:new_message', payload);
  }
}
