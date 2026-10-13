import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';

let socket: Socket | null = null;
const matchWatchers = new Map<string, number>();

/** Socket compartido por toda la app; se conecta la primera vez que alguien lo pide. */
export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10_000,
      timeout: 8000,
    });
    socket.on('connect', () => {
      matchWatchers.forEach((_, matchId) => socket?.emit('match:watch', { matchId }));
    });
  }
  return socket;
}

/** Entra a la sala del partido; varias pantallas pueden mirar el mismo partido a la vez. */
export function watchMatchRoom(matchId: string): () => void {
  const s = getRealtimeSocket();
  const count = matchWatchers.get(matchId) ?? 0;
  matchWatchers.set(matchId, count + 1);
  if (count === 0) s.emit('match:watch', { matchId });

  return () => {
    const current = matchWatchers.get(matchId) ?? 0;
    if (current <= 1) {
      matchWatchers.delete(matchId);
      s.emit('match:unwatch', { matchId });
    } else {
      matchWatchers.set(matchId, current - 1);
    }
  };
}

export function useRealtimeConnected(): boolean {
  const [connected, setConnected] = useState(() => getRealtimeSocket().connected);
  useEffect(() => {
    const s = getRealtimeSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onDisconnect);
    setConnected(s.connected);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onDisconnect);
    };
  }, []);
  return connected;
}
