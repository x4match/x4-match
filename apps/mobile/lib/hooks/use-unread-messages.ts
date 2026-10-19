import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const UNREAD_MESSAGES_QUERY_KEY = ['conversations-unread'] as const;
export const UNREAD_MATCH_CHATS_QUERY_KEY = ['match-chats-unread'] as const;

const DM_NOTIFICATION_TYPES = new Set(['DM_MESSAGE', 'DM_REQUEST', 'DM_REQUEST_ACCEPTED']);
const MATCH_CHAT_NOTIFICATION_TYPE = 'MATCH_CHAT_MESSAGE';

export type UnreadMatchChats = {
  count: number;
  byMatch: Record<string, number>;
};

/** Mensajes sin leer por partido en los chats grupales donde estás anotado. */
export function useUnreadMatchChats(enabled = true) {
  return useQuery({
    queryKey: UNREAD_MATCH_CHATS_QUERY_KEY,
    queryFn: async (): Promise<UnreadMatchChats> => {
      const res = await api.get('/matches/me/unread-chats');
      const rows = (res.data?.matches ?? []) as Array<{ matchId: string; unreadCount: number }>;
      const byMatch: Record<string, number> = {};
      rows.forEach((row) => {
        byMatch[row.matchId] = Number(row.unreadCount ?? 0);
      });
      return { count: Number(res.data?.count ?? 0), byMatch };
    },
    enabled,
    refetchInterval: 60_000,
  });
}

/**
 * Total para el badge de Mensajes: directos sin leer + solicitudes recibidas + chats de partido.
 * Se refresca solo al recibir un push de mensaje con la app abierta.
 */
export function useUnreadMessagesCount(enabled = true) {
  const queryClient = useQueryClient();

  const { data: directCount } = useQuery({
    queryKey: UNREAD_MESSAGES_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get('/conversations/unread-count');
      return Number(res.data?.count ?? 0);
    },
    enabled,
    refetchInterval: 60_000,
  });
  const { data: matchChats } = useUnreadMatchChats(enabled);

  useEffect(() => {
    if (!enabled) return;
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const payload = (notification.request.content.data ?? {}) as Record<string, unknown>;
      const type = typeof payload.type === 'string' ? payload.type : '';
      if (DM_NOTIFICATION_TYPES.has(type)) {
        queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
        if (typeof payload.conversationId === 'string') {
          queryClient.invalidateQueries({ queryKey: ['dm-messages', payload.conversationId] });
        }
      } else if (type === MATCH_CHAT_NOTIFICATION_TYPE) {
        queryClient.invalidateQueries({ queryKey: UNREAD_MATCH_CHATS_QUERY_KEY });
        if (typeof payload.matchId === 'string') {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', payload.matchId] });
        }
      }
    });
    return () => sub.remove();
  }, [enabled, queryClient]);

  if (!enabled) return 0;
  return (directCount ?? 0) + (matchChats?.count ?? 0);
}
