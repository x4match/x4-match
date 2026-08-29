import { ScrollView, Text, View, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { mapMatch } from '@/lib/mappers';
import type { DirectConversation, Match } from '@/lib/types';
import { formatShortDate, formatTime, formatRelativeTime } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import { Screen, AppHeader, AppCard, EmptyState, Avatar, PrimaryButton } from '@/components/padely';

const CHAT_STATUSES = ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS', 'FINISHED'];

type FriendPendingIncoming = {
  id: string;
  requester_id: string;
  created_at: string;
  name: string;
  photo_url?: string;
  nickname?: string;
};

type FriendPendingOutgoing = {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  photo_url?: string;
};

export default function MessagesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClubAccount = isClub(user?.role);

  const { data: conversations, isLoading: loadingDm, refetch: refetchDm } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data as DirectConversation[];
    },
  });

  const { data: pendingRequests, refetch: refetchPending } = useQuery({
    queryKey: ['conversations-pending'],
    queryFn: async () => {
      const res = await api.get('/conversations/pending');
      return res.data as any[];
    },
  });

  const { data: friendPending, refetch: refetchFriends } = useQuery({
    queryKey: ['friends-pending'],
    queryFn: async () => {
      const res = await api.get('/friends/pending');
      return res.data as { incoming: FriendPendingIncoming[]; outgoing: FriendPendingOutgoing[] };
    },
    enabled: !isClubAccount,
  });

  const { data: matches, isLoading: loadingMatches, refetch: refetchMatches } = useQuery({
    queryKey: ['my-matches-messages'],
    queryFn: async () => {
      const res = await api.get('/matches/me');
      return res.data;
    },
    enabled: !isClubAccount,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
    },
  });

  const acceptFriendMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/friends/accept/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends-pending'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['friend-relation'] });
      Alert.alert('Listo', 'Ahora son amigos.');
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo aceptar la solicitud'),
  });

  const rejectFriendMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/friends/reject/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends-pending'] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo rechazar la solicitud'),
  });

  const onRefresh = () => {
    refetchDm();
    refetchPending();
    if (!isClubAccount) {
      refetchFriends();
      refetchMatches();
    }
  };

  const isLoading = loadingDm || (!isClubAccount && loadingMatches);
  const activeConversations = (conversations || []).filter((c) => c.status === 'active');
  const pendingOutgoing = (conversations || []).filter((c) => c.status === 'pending');
  const friendIncoming = friendPending?.incoming ?? [];
  const friendOutgoing = friendPending?.outgoing ?? [];
  const matchConversations: Match[] = (matches || [])
    .map(mapMatch)
    .filter((m: Match) => CHAT_STATUSES.includes(m.status))
    .sort((a: Match, b: Match) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Screen>
      <AppHeader title="Mensajes" />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        {!isClubAccount && friendIncoming.length > 0 && (
          <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: ui.colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>
              Solicitudes de amistad
            </Text>
            {friendIncoming.map((req) => (
              <AppCard key={req.id} style={{ marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => router.push(`/player/${req.requester_id}` as any)}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={req.name} photo={req.photo_url} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{req.name}</Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                        Quiere ser tu amigo · Tocá para ver perfil
                      </Text>
                    </View>
                    <Ionicons name="person-add-outline" size={18} color={ui.colors.primary} />
                  </View>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label="Aceptar"
                      size="sm"
                      fullWidth
                      onPress={() => acceptFriendMutation.mutate(req.id)}
                      loading={acceptFriendMutation.isPending}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label="Rechazar"
                      size="sm"
                      variant="ghost"
                      fullWidth
                      onPress={() => rejectFriendMutation.mutate(req.id)}
                      loading={rejectFriendMutation.isPending}
                      style={{ backgroundColor: ui.colors.surface }}
                    />
                  </View>
                </View>
              </AppCard>
            ))}
          </>
        )}

        {(pendingRequests?.length ?? 0) > 0 && (
          <>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: ui.colors.textMuted,
                marginBottom: 8,
                marginTop: friendIncoming.length > 0 ? 12 : 0,
                textTransform: 'uppercase',
              }}
            >
              Solicitudes de mensaje
            </Text>
            {pendingRequests!.map((req: any) => (
              <AppCard key={req.id} style={{ marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => req.from_user_id && router.push(`/player/${req.from_user_id}` as any)}
                  activeOpacity={0.85}
                  disabled={!req.from_user_id}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={req.from_user_name} photo={req.from_user_photo} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{req.from_user_name}</Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                        Quiere enviarte mensajes · Tocá para ver perfil
                      </Text>
                    </View>
                    <Ionicons name="person-outline" size={18} color={ui.colors.textMuted} />
                  </View>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label="Aceptar"
                      size="sm"
                      fullWidth
                      onPress={() =>
                        acceptMutation.mutate(req.id, {
                          onSuccess: () =>
                            router.push({
                              pathname: `/conversation/${req.id}` as any,
                              params: {
                                name: req.from_user_name,
                                status: 'active',
                                userId: req.from_user_id,
                              },
                            }),
                        })
                      }
                      loading={acceptMutation.isPending}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label="Ver chat"
                      size="sm"
                      variant="ghost"
                      fullWidth
                      onPress={() =>
                        router.push({
                          pathname: `/conversation/${req.id}` as any,
                          params: {
                            name: req.from_user_name,
                            status: 'pending',
                            userId: req.from_user_id,
                          },
                        })
                      }
                      style={{ backgroundColor: ui.colors.surface }}
                    />
                  </View>
                </View>
              </AppCard>
            ))}
          </>
        )}

        {(pendingOutgoing.length > 0 || friendOutgoing.length > 0) && (
          <>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: ui.colors.textMuted,
                marginBottom: 8,
                marginTop: 12,
                textTransform: 'uppercase',
              }}
            >
              Esperando respuesta
            </Text>
            {friendOutgoing.map((req) => (
              <AppCard
                key={`friend-out-${req.id}`}
                padding="sm"
                style={{ marginBottom: 8, opacity: 0.85 }}
                onPress={() => router.push(`/player/${req.user_id}` as any)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={req.name} photo={req.photo_url} size="sm" />
                  <Text style={{ flex: 1, fontSize: 14, color: ui.colors.textSecondary }}>
                    Amistad enviada a{' '}
                    <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{req.name}</Text>
                  </Text>
                  <Ionicons name="person-add-outline" size={18} color={ui.colors.textMuted} />
                </View>
              </AppCard>
            ))}
            {pendingOutgoing.map((c) => (
              <AppCard
                key={c.id}
                padding="sm"
                style={{ marginBottom: 8, opacity: 0.85 }}
                onPress={
                  c.other_user_id
                    ? () => router.push(`/player/${c.other_user_id}` as any)
                    : undefined
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={c.other_user_name} photo={c.other_user_photo} size="sm" />
                  <Text style={{ flex: 1, fontSize: 14, color: ui.colors.textSecondary }}>
                    Solicitud enviada a{' '}
                    <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{c.other_user_name}</Text>
                  </Text>
                  <Ionicons name="person-outline" size={18} color={ui.colors.textMuted} />
                </View>
              </AppCard>
            ))}
          </>
        )}

        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: ui.colors.textMuted,
            marginBottom: 8,
            marginTop: 12,
            textTransform: 'uppercase',
          }}
        >
          Chats directos
        </Text>
        {activeConversations.length === 0 && !loadingDm ? (
          <EmptyState
            icon={<Ionicons name="chatbubbles-outline" size={28} color={ui.colors.textMuted} />}
            title="Sin chats directos"
            description={
              isClubAccount
                ? 'Contactá jugadores desde su perfil para iniciar una conversación'
                : 'Mandá mensaje a alguien con quien hayas jugado o que sea tu amigo'
            }
          />
        ) : (
          activeConversations.map((c) => (
            <AppCard
              key={c.id}
              onPress={() =>
                router.push({
                  pathname: `/conversation/${c.id}` as any,
                  params: {
                    name: c.other_user_name,
                    status: 'active',
                    userId: c.other_user_id,
                  },
                })
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={c.other_user_name} photo={c.other_user_photo} size="md" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }}>{c.other_user_name}</Text>
                  {c.last_message ? (
                    <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                      {c.last_message}
                    </Text>
                  ) : null}
                </View>
                {c.last_message_at ? (
                  <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>{formatRelativeTime(c.last_message_at)}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          ))
        )}

        {!isClubAccount && (
          <>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: ui.colors.textMuted,
                marginBottom: 8,
                marginTop: 20,
                textTransform: 'uppercase',
              }}
            >
              Chats de partidos
            </Text>
            {matchConversations.length === 0 && !loadingMatches ? (
              <EmptyState
                icon={<Ionicons name="tennisball-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin chats de partido"
                description="Los chats de tus partidos aparecerán acá"
              />
            ) : (
              matchConversations.map((match) => (
                <AppCard key={match.id} onPress={() => router.push(`/match/${match.id}` as any)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: 'rgba(20,184,166,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="chatbubble" size={22} color={ui.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }} numberOfLines={1}>
                        {match.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                        {match.club?.name || 'Partido'} · {formatShortDate(match.date)} {formatTime(match.date)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={ui.colors.textMuted} />
                  </View>
                </AppCard>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
