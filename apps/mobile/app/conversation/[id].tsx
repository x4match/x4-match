import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { DirectMessage } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, PrimaryButton, Avatar } from '@/components/padely';

export default function ConversationScreen() {
  const { id, name, status, userId: userIdParam } = useLocalSearchParams<{
    id: string;
    name?: string;
    status?: string;
    userId?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const isPending = status === 'pending';

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data as Array<{
        id: string;
        other_user_id: string;
        other_user_name: string;
        other_user_photo?: string;
      }>;
    },
  });

  const conversationMeta = conversations?.find((c) => c.id === id);
  const otherUserId = userIdParam || conversationMeta?.other_user_id;
  const displayName = name || conversationMeta?.other_user_name || 'Chat';
  const otherUserPhoto = conversationMeta?.other_user_photo;

  const openProfile = () => {
    if (!otherUserId) return;
    router.push(`/player/${otherUserId}` as any);
  };

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['dm-messages', id],
    queryFn: async () => {
      const res = await api.get(`/conversations/${id}/messages`);
      return res.data as DirectMessage[];
    },
    enabled: !!id && !isPending,
  });

  const acceptMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
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
          otherUserId ? (
            <TouchableOpacity
              onPress={openProfile}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Ver perfil de ${displayName}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: ui.radius.md,
                backgroundColor: ui.colors.surface,
              }}
            >
              <Ionicons name="person-outline" size={18} color={ui.colors.textInverse} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textInverse }}>Perfil</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        {isPending ? (
          <View style={{ flex: 1, padding: ui.spacing.lg, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={openProfile} disabled={!otherUserId} activeOpacity={0.85}>
                <Avatar name={displayName} photo={otherUserPhoto} size="xl" />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: ui.colors.textInverse, marginTop: 16, textAlign: 'center' }}>
                Solicitud de mensaje
              </Text>
              <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginTop: 8, textAlign: 'center' }}>
                {displayName} quiere enviarte mensajes. Aceptá para empezar a chatear.
              </Text>
              {otherUserId ? (
                <TouchableOpacity onPress={openProfile} style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.primary }}>Ver perfil</Text>
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
                    <View
                      key={msg.id}
                      style={{
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        marginBottom: 10,
                        backgroundColor: mine ? ui.colors.primary : ui.colors.surface,
                        borderRadius: ui.radius.md,
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: mine ? '#fff' : ui.colors.textPrimary, fontSize: 15 }}>{msg.content}</Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: mine ? 'rgba(255,255,255,0.7)' : ui.colors.textMuted,
                          marginTop: 4,
                          textAlign: 'right',
                        }}
                      >
                        {formatRelativeTime(msg.created_at)}
                      </Text>
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
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
