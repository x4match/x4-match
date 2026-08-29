import { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { mapPlayer, mapPlayerMatchHistory } from '@/lib/mappers';
import { resolveSkillScore } from '@/lib/skill';
import type { MessageAccess, BadgesSummary } from '@/lib/types';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, Avatar, PrimaryButton, PlayerMatchStatsCard, PlayerMatchHistoryList, SkillProgress, ProfilePhotoViewer, BadgesSection } from '@/components/padely';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';

const REPORT_REASONS = [
  'Comportamiento inapropiado',
  'Spam o publicidad',
  'Perfil falso o suplantación',
  'Acoso o mensajes ofensivos',
  'Trampa o resultados falsos',
  'Otro motivo',
] as const;

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const { data: playerRaw, isLoading } = useQuery({
    queryKey: ['player-profile', id],
    queryFn: async () => {
      const res = await api.get(`/players/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: matchHistoryRaw, isLoading: loadingHistory } = useQuery({
    queryKey: ['match-history', id],
    queryFn: async () => {
      const res = await api.get(`/players/${id}/match-history`, { params: { limit: 15 } });
      return res.data;
    },
    enabled: !!id,
  });

  const matchHistory = matchHistoryRaw ? mapPlayerMatchHistory(matchHistoryRaw) : null;

  const targetUserId = playerRaw?.user_id ?? playerRaw?.userId ?? id;
  const isClubAccount = isClub(user?.role);

  const { data: playerBadgesSummary } = useQuery({
    queryKey: ['badges-user', targetUserId],
    queryFn: async () => {
      const res = await api.get(`/badges/user/${targetUserId}`);
      return res.data as BadgesSummary;
    },
    enabled: !!targetUserId,
  });

  const { data: messageAccess, refetch: refetchAccess } = useQuery({
    queryKey: ['message-access', targetUserId],
    queryFn: async () => {
      const res = await api.get(`/conversations/access/${targetUserId}`);
      return res.data as MessageAccess;
    },
    enabled: !!targetUserId && targetUserId !== user?.id,
  });

  const { data: friendRelation, refetch: refetchFriend } = useQuery({
    queryKey: ['friend-relation', targetUserId],
    queryFn: async () => {
      const res = await api.get(`/friends/relation/${targetUserId}`);
      return res.data as { status: string; requestId?: string };
    },
    enabled: !!targetUserId && targetUserId !== user?.id,
  });

  const { data: followCounts, refetch: refetchFollowCounts } = useQuery({
    queryKey: ['follow-counts', targetUserId],
    queryFn: async () => {
      const res = await api.get(`/follows/counts/${targetUserId}`);
      return res.data as { followers: number; following: number };
    },
    enabled: !!targetUserId,
  });

  const { data: followRelation, refetch: refetchFollowRelation } = useQuery({
    queryKey: ['follow-relation', targetUserId],
    queryFn: async () => {
      const res = await api.get(`/follows/relation/${targetUserId}`);
      return res.data as { status: string; following: boolean };
    },
    enabled: !!targetUserId && targetUserId !== user?.id,
  });

  const player = playerRaw ? mapPlayer(playerRaw) : null;
  const isSelf = user?.id === targetUserId;

  const requestMessageMutation = useMutation({
    mutationFn: () => api.post(`/conversations/request/${targetUserId}`),
    onSuccess: (res) => {
      refetchAccess();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (res.data?.status === 'active' && res.data?.conversationId) {
        router.push({
          pathname: `/conversation/${res.data.conversationId}` as any,
          params: { name: player?.name, status: 'active', userId: targetUserId },
        });
      } else {
        Alert.alert('Solicitud enviada', 'Cuando acepten podrás chatear.');
      }
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'No se pudo enviar la solicitud'),
  });

  const openChat = () => {
    if (messageAccess?.canMessage && messageAccess.conversationId) {
      router.push({
        pathname: `/conversation/${messageAccess.conversationId}` as any,
        params: { name: player?.name, status: 'active', userId: targetUserId },
      });
    } else if (messageAccess?.canMessage) {
      setActionLoading(true);
      api
        .post(`/conversations/request/${targetUserId}`)
        .then((res) => {
          router.push({
            pathname: `/conversation/${res.data.conversationId}` as any,
            params: { name: player?.name, status: 'active', userId: targetUserId },
          });
        })
        .catch((e) => Alert.alert('Error', e?.response?.data?.message || 'No se pudo abrir el chat'))
        .finally(() => setActionLoading(false));
    }
  };

  const friendRequestMutation = useMutation({
    mutationFn: () => api.post(`/friends/request/${targetUserId}`),
    onSuccess: () => {
      refetchFriend();
      Alert.alert('Listo', 'Solicitud de amistad enviada');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'No se pudo enviar'),
  });

  const acceptFriendMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/friends/accept/${requestId}`),
    onSuccess: () => {
      refetchFriend();
      refetchAccess();
      refetchFollowCounts();
      refetchFollowRelation();
      queryClient.invalidateQueries({ queryKey: ['follow-counts', 'me'] });
    },
  });

  const followMutation = useMutation({
    mutationFn: () =>
      followRelation?.following
        ? api.delete(`/follows/${targetUserId}`)
        : api.post(`/follows/${targetUserId}`),
    onSuccess: () => {
      refetchFollowRelation();
      refetchFollowCounts();
      queryClient.invalidateQueries({ queryKey: ['follow-counts', 'me'] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo actualizar el seguimiento'),
  });

  const blockPlayerMutation = useMutation({
    mutationFn: () => api.post(`/reports/block/${targetUserId}`),
    onSuccess: () => {
      Alert.alert('Jugador bloqueado', 'Ya no verás a este jugador en la app.');
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo bloquear al jugador');
    },
  });

  const reportPlayerMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post('/reports', {
        reportedUserId: targetUserId,
        reason,
      }),
    onSuccess: () => {
      setShowReportModal(false);
      Alert.alert(
        'Reporte enviado',
        'Vamos a revisarlo. ¿Querés bloquear a este jugador también?',
        [
          { text: 'No, gracias', style: 'cancel' },
          {
            text: 'Bloquear jugador',
            style: 'destructive',
            onPress: () => blockPlayerMutation.mutate(),
          },
        ],
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo enviar el reporte');
    },
  });

  const renderMessageAction = () => {
    if (isSelf || !messageAccess) return null;

    if (messageAccess.canMessage) {
      return (
        <PrimaryButton
          label="Enviar mensaje"
          onPress={openChat}
          loading={actionLoading}
          fullWidth
          size="lg"
          icon={<Ionicons name="chatbubble-outline" size={18} color="#fff" />}
          style={{ marginTop: 16 }}
        />
      );
    }

    if (messageAccess.reason === 'pending_outgoing') {
      return (
        <View style={{ marginTop: 16, padding: 14, backgroundColor: ui.colors.surface, borderRadius: ui.radius.md }}>
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, textAlign: 'center' }}>
            Solicitud de mensaje enviada. Esperá a que {player?.name?.split(' ')[0]} la acepte.
          </Text>
        </View>
      );
    }

    if (messageAccess.reason === 'pending_incoming') {
      return (
        <PrimaryButton
          label="Aceptar solicitud de mensaje"
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
            router.push('/(tabs)/messages' as any);
          }}
          fullWidth
          size="lg"
          style={{ marginTop: 16 }}
        />
      );
    }

    if (messageAccess.reason === 'need_request' || messageAccess.canSendRequest) {
      return (
        <>
          <Text style={{ fontSize: 12, color: ui.colors.textMuted, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 }}>
            {isClubAccount
              ? 'Enviá una solicitud de mensaje para contactar a este jugador.'
              : 'Para chatear necesitás ser amigos o haber jugado un partido juntos. Si no, enviá una solicitud de mensaje.'}
          </Text>
          <PrimaryButton
            label="Solicitar enviar mensaje"
            onPress={() => requestMessageMutation.mutate()}
            loading={requestMessageMutation.isPending}
            fullWidth
            size="lg"
            variant="ghost"
            style={{ marginTop: 12, backgroundColor: ui.colors.surface }}
          />
        </>
      );
    }

    return null;
  };

  const renderFriendAction = () => {
    if (isSelf || !friendRelation) return null;
    if (friendRelation.status === 'friends') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <Ionicons name="people" size={16} color={ui.colors.primary} />
          <Text style={{ fontSize: 13, color: ui.colors.primary, fontWeight: '600' }}>Son amigos</Text>
        </View>
      );
    }
    if (friendRelation.status === 'pending_outgoing') {
      return (
        <Text style={{ fontSize: 13, color: ui.colors.textMuted, textAlign: 'center', marginTop: 12 }}>
          Solicitud de amistad pendiente
        </Text>
      );
    }
    if (friendRelation.status === 'pending_incoming' && friendRelation.requestId) {
      return (
        <PrimaryButton
          label="Aceptar amistad"
          onPress={() => acceptFriendMutation.mutate(friendRelation.requestId!)}
          loading={acceptFriendMutation.isPending}
          fullWidth
          size="md"
          style={{ marginTop: 12 }}
        />
      );
    }
    if (friendRelation.status === 'none') {
      return (
        <PrimaryButton
          label="Agregar amigo"
          onPress={() => friendRequestMutation.mutate()}
          loading={friendRequestMutation.isPending}
          fullWidth
          size="md"
          variant="ghost"
          style={{ marginTop: 12, backgroundColor: ui.colors.surface }}
          icon={<Ionicons name="person-add-outline" size={18} color={ui.colors.primary} />}
        />
      );
    }
    return null;
  };

  if (isLoading || !player) {
    return (
      <Screen>
        <StackHeader title="Jugador" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title="Perfil de jugador" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => player.photo_url && setShowPhotoViewer(true)}
          disabled={!player.photo_url}
          activeOpacity={0.9}
        >
          <Avatar name={player.name} photo={player.photo_url} size="xl" style={{ marginBottom: 12 }} />
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '800', color: ui.colors.textInverse }}>{player.name}</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            marginTop: 14,
          }}
        >
          <View style={{ alignItems: 'center', minWidth: 72 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textInverse }}>
              {followCounts?.followers ?? 0}
            </Text>
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>Seguidores</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: ui.colors.border }} />
          <View style={{ alignItems: 'center', minWidth: 72 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textInverse }}>
              {followCounts?.following ?? 0}
            </Text>
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>Seguidos</Text>
          </View>
        </View>
        {player.photo_url ? (
          <Text style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 8 }}>
            Tocá la foto para verla en grande
          </Text>
        ) : null}
        {!isSelf && user && !isClubAccount ? (
          <PrimaryButton
            label={followRelation?.following ? 'Siguiendo' : 'Seguir'}
            onPress={() => followMutation.mutate()}
            loading={followMutation.isPending}
            fullWidth
            size="md"
            variant={followRelation?.following ? 'ghost' : 'primary'}
            style={{
              marginTop: 14,
              backgroundColor: followRelation?.following ? ui.colors.surface : undefined,
            }}
            icon={
              <Ionicons
                name={followRelation?.following ? 'checkmark' : 'person-add-outline'}
                size={16}
                color={followRelation?.following ? ui.colors.primary : '#fff'}
              />
            }
          />
        ) : null}
        <View style={{ width: '100%', marginTop: 12, paddingHorizontal: 20 }}>
          <SkillProgress
            score={resolveSkillScore(player.skillScore, player.rating)}
            category={player.levelCategory}
            label="Nivel del jugador"
            dark
          />
        </View>
        {(player.zone || player.city) && (
          <Text style={{ color: ui.colors.textMuted, fontSize: 13, marginTop: 4 }}>{player.zone || player.city}</Text>
        )}
        {player.bio ? (
          <Text style={{ color: ui.colors.textMuted, textAlign: 'center', marginTop: 12, paddingHorizontal: 24, fontSize: 13 }}>
            {player.bio}
          </Text>
        ) : null}

        {renderFriendAction()}
        {renderMessageAction()}

        <View style={{ width: '100%', marginTop: 24, gap: 12 }}>
          <PlayerMatchStatsCard stats={player.matchStats} />
          <PlayerMatchHistoryList
            data={matchHistory}
            title="Historial de partidos"
            loading={loadingHistory}
            limit={15}
          />
          <BadgesSection
            badges={playerBadgesSummary?.earned}
            earnedCount={playerBadgesSummary?.earnedCount}
            total={playerBadgesSummary?.total}
            title="Insignias"
            onPress={() =>
              router.push({
                pathname: '/badges' as any,
                params: { userId: targetUserId, name: player.name },
              })
            }
          />

          <AppCard>
            <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 10 }}>Detalles</Text>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 6 }}>
              Posición: {player.position || 'No definida'}
            </Text>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 6 }}>
              Ciudad: {player.city || 'No definida'}
            </Text>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 6 }}>
              Zona: {player.zone || 'No definida'}
            </Text>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>
              Categoría inicial: {player.declaredCategory || 'No informada'}
            </Text>
            {player.categoryStatus === 'provisional' ? (
              <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 6 }}>
                En nivelación · {player.placementMatchesPlayed ?? 0}/
                {player.placementMatchesRequired ?? 5} partidos
              </Text>
            ) : null}
          </AppCard>

          {!isSelf && user ? (
            <TouchableOpacity
              onPress={() => setShowReportModal(true)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                borderRadius: ui.radius.md,
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.25)',
                backgroundColor: 'rgba(239,68,68,0.08)',
              }}
            >
              <Ionicons name="flag-outline" size={18} color={ui.colors.danger} />
              <Text style={{ color: ui.colors.danger, fontWeight: '700', fontSize: 14 }}>
                Reportar jugador
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: ui.colors.overlay, justifyContent: 'flex-end' }}
          onPress={() => setShowReportModal(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: ui.colors.surface1,
              borderTopLeftRadius: ui.radius.xl,
              borderTopRightRadius: ui.radius.xl,
              padding: ui.spacing.lg,
              paddingBottom: 32,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary, marginBottom: 6 }}>
              Reportar a {player.name.split(' ')[0]}
            </Text>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 16 }}>
              Elegí el motivo. Revisaremos el reporte y tomaremos acción si corresponde.
            </Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                disabled={reportPlayerMutation.isPending}
                onPress={() => reportPlayerMutation.mutate(reason)}
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: ui.colors.border,
                }}
              >
                <Text style={{ fontSize: 15, color: ui.colors.textPrimary }}>{reason}</Text>
              </TouchableOpacity>
            ))}
            {reportPlayerMutation.isPending ? (
              <ActivityIndicator color={ui.colors.primary} style={{ marginTop: 16 }} />
            ) : (
              <TouchableOpacity
                onPress={() => setShowReportModal(false)}
                style={{ paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
              >
                <Text style={{ color: ui.colors.textMuted, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      <ProfilePhotoViewer
        visible={showPhotoViewer}
        photo={player.photo_url}
        name={player.name}
        onClose={() => setShowPhotoViewer(false)}
      />
    </Screen>
  );
}
