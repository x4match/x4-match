import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { DirectConversation, DirectMessage } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';
import { UNREAD_MESSAGES_QUERY_KEY } from '@/lib/hooks/use-unread-messages';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, PrimaryButton, Avatar, ChatBubble, KeyboardAvoid } from '@/components/x4match';

export default function ConversationScreen() {
  const { id, name, status, userId: userIdParam, clubId: clubIdParam, draft } = useLocalSearchParams<{
    id: string;
    name?: string;
    status?: string;
    userId?: string;
    clubId?: string;
    draft?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState(draft ?? '');
  const scrollRef = useRef<ScrollView>(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data as DirectConversation[];
    },
  });

  const conversationMeta = conversations?.find((c) => c.id === id);
  const isPending = (conversationMeta?.status ?? status) === 'pending';
  const otherUserId = userIdParam || conversationMeta?.other_user_id;
  const otherClubId = clubIdParam || conversationMeta?.other_club_id || undefined;
  const displayName = conversationMeta?.other_user_name || name || 'Chat';
  const otherUserPhoto = conversationMeta?.other_user_photo;
  const canOpenProfile = !!(otherClubId || otherUserId);

  const openProfile = () => {
    if (otherClubId) router.push(`/club/${otherClubId}` as any);
    else if (otherUserId) router.push(`/player/${otherUserId}` as any);
  };

  const { data: messages, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dm-messages', id],
    queryFn: async () => {
      const res = await api.get(`/conversations/${id}/messages`);
      return res.data as DirectMessage[];
    },
    enabled: !!id && !isPending,
  });

  useEffect(() => {
    if (!id || isPending || !dataUpdatedAt) return;
    queryClient.setQueryData<DirectConversation[]>(['conversations'], (prev) =>
      prev?.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
    );
    api
      .post(`/conversations/${id}/read`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      })
      .catch(() => undefined);
  }, [id, isPending, dataUpdatedAt, queryClient]);

  const acceptMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
      queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_QUERY_KEY });
      router.setParams({ status: 'active' } as any);
      refetch();
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'No se pudo aceptar'),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.post(`/conversations/${id}/messages`, { content }),
    onSuccess: () => {
      setText('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'No se pudo enviar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => api.delete(`/conversations/${id}/messages/${messageId}`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'No se pudo borrar'),
  });

  const deleteChatMutation = useMutation({
    mutationFn: () => api.delete(`/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
      queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ['dm-messages', id] });
      router.back();
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo borrar el chat'),
  });

  const confirmDeleteMessage = (messageId: string) => {
    Alert.alert('Borrar mensaje', '¿Querés borrar este mensaje? Se eliminará para ambos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(messageId),
      },
    ]);
  };

  const openChatActions = () => {
    const buttons: Array<{
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }> = [];

    if (canOpenProfile) {
      buttons.push({ text: otherClubId ? 'Ver club' : 'Ver perfil', onPress: openProfile });
    }
    buttons.push({
      text: 'Borrar chat',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Borrar chat',
          `¿Querés borrar el chat con ${displayName}?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Borrar',
              style: 'destructive',
              onPress: () => deleteChatMutation.mutate(),
            },
          ],
        );
      },
    });
    buttons.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert(displayName, undefined, buttons);
  };

  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages?.length]);

  return (
    <Screen>
      <StackHeader
        title={displayName}
        rightAction={
          <TouchableOpacity
            onPress={openChatActions}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Opciones del chat"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: ui.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={ui.colors.textInverse} />
          </TouchableOpacity>
        }
      />
      <KeyboardAvoid style={{ flex: 1 }} keyboardVerticalOffset={88}>
        {isPending ? (
          <View style={{ flex: 1, padding: ui.spacing.lg, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={openProfile} disabled={!canOpenProfile} activeOpacity={0.85}>
                <Avatar name={displayName} photo={otherUserPhoto} size="xl" />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: ui.colors.textInverse, marginTop: 16, textAlign: 'center' }}>
                Solicitud de mensaje
              </Text>
              <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginTop: 8, textAlign: 'center' }}>
                {displayName} quiere enviarte mensajes. Aceptá para empezar a chatear.
              </Text>
              {canOpenProfile ? (
                <TouchableOpacity onPress={openProfile} style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.primary }}>
                    {otherClubId ? 'Ver club' : 'Ver perfil'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <PrimaryButton label="Aceptar solicitud" onPress={() => acceptMutation.mutate()} loading={acceptMutation.isPending} fullWidth size="lg" />
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ padding: ui.spacing.lg, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              {isLoading ? (
                <Text style={{ color: ui.colors.textMuted, textAlign: 'center' }}>Cargando...</Text>
              ) : !messages?.length ? (
                <Text style={{ color: ui.colors.textMuted, textAlign: 'center' }}>Escribí el primer mensaje</Text>
              ) : (
                messages.map((msg) => {
                  const mine = msg.sender_id === user?.id;
                  return (
                    <View key={msg.id} style={{ marginBottom: 8 }}>
                      <ChatBubble
                        mine={mine}
                        content={msg.content}
                        timeLabel={formatRelativeTime(msg.created_at)}
                        disabled={deleteMutation.isPending}
                        onLongPress={mine ? () => confirmDeleteMessage(msg.id) : undefined}
                        accessibilityHint={mine ? 'Mantener pulsado para borrar' : undefined}
                      />
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: ui.spacing.md,
                borderTopWidth: 1,
                borderTopColor: ui.colors.surfaceAlt,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Escribí un mensaje..."
                placeholderTextColor={ui.colors.textMuted}
                style={{
                  flex: 1,
                  backgroundColor: ui.colors.surface,
                  borderRadius: ui.radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: ui.colors.textPrimary,
                  fontSize: 15,
                }}
                multiline
              />
              <TouchableOpacity
                onPress={() => text.trim() && sendMutation.mutate(text.trim())}
                disabled={!text.trim() || sendMutation.isPending}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: ui.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !text.trim() ? 0.5 : 1,
                }}
              >
                <Ionicons name="send" size={20} color={ui.colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoid>
    </Screen>
  );
}
