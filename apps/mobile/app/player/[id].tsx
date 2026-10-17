import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { ageFromBirthDate } from '@/lib/age';
import { mapPlayer, mapPlayerMatchHistory } from '@/lib/mappers';
import { formatSkillScore, resolveSkillScore } from '@/lib/skill';
import type { MessageAccess, BadgesSummary } from '@/lib/types';
import { ui, fontFamily } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  StackHeader,
  AppCard,
  Avatar,
  PrimaryButton,
  PlayerMatchStatsCard,
  PlayerMatchHistoryList,
  ProfilePhotoViewer,
  BadgesSection,
  FadeInUp,
  PressableScale,
  TournamentTitlesCard,
  CircuitRoleBadges,
} from '@/components/x4match';
import { CircularProgressRing } from '@/components/x4match/CircularProgressRing';
import { useAuth } from '@/contexts/AuthContext';
import { isClub, isPlayer } from '@/lib/roles';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const CARD_BG = '#161616';
const LEVEL_STRIPES = require('../../assets/figma/profile/tiras.png');

const REPORT_REASONS = [
  'Comportamiento inapropiado',
  'Spam o publicidad',
  'Perfil falso o suplantación',
  'Acoso o mensajes ofensivos',
  'Trampa o resultados falsos',
  'Otro motivo',
] as const;

function formatPositionLabel(pos?: string | null) {
  if (!pos) return 'No definida';
  const key = pos.trim().toLowerCase();
  if (key === 'drive') return 'Drive';
  if (key === 'reves' || key === 'revés') return 'Revés';
  if (key === 'ambos') return 'Ambos';
  return pos.charAt(0).toUpperCase() + pos.slice(1);
}

function formatHandLabel(hand?: string | null) {
  if (!hand) return 'No definida';
  const key = hand.trim().toLowerCase();
  if (key === 'right' || key === 'derecha') return 'Derecha';
  if (key === 'left' || key === 'izquierda') return 'Izquierda';
  return hand.charAt(0).toUpperCase() + hand.slice(1);
}

function formatGenderLabel(gender?: string | null) {
  if (!gender) return 'No informado';
  const key = gender.trim().toLowerCase();
  if (key === 'male' || key === 'masculino' || key === 'hombre') return 'Masculino';
  if (key === 'female' || key === 'femenino' || key === 'mujer') return 'Femenino';
  if (key === 'other' || key === 'otro') return 'Otro';
  if (key === 'prefer_not_to_say' || key === 'prefiero_no_decir') return 'Prefiere no decir';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ fontSize: 13, color: MUTED, fontFamily: fontFamily.regular }}>{label}</Text>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: '600',
          color: ui.colors.textPrimary,
          fontFamily: fontFamily.regular,
          textAlign: 'right',
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function LevelStripes({ width = 200, height = 160 }: { width?: number; height?: number }) {
  return (
    <Image
      source={LEVEL_STRIPES}
      style={{ width, height }}
      resizeMode="cover"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function LimeButton({
  label,
  onPress,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: LIME,
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <>
          {icon}
          <Text
            style={{
              color: '#000000',
              fontSize: 15,
              fontWeight: '700',
              fontFamily: fontFamily.regular,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [actionLoading, setActionLoading] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const { data: playerRaw, isLoading, isError: playerError, error: playerQueryError } = useQuery({
    queryKey: ['player-profile', id],
    queryFn: async () => {
      const res = await api.get(`/players/${id}`);
      return res.data;
    },
    enabled: !!id,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 403) return false;
      return failureCount < 2;
    },
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

  const openChallenge = () => {
    router.push({
      pathname: '/challenge/create' as any,
      params: { targetUserId },
    });
  };

  const followMutation = useMutation({
    mutationFn: () =>
      followRelation?.following
        ? api.delete(`/follows/${targetUserId}`)
        : api.post(`/follows/${targetUserId}`),
    onSuccess: () => {
      refetchFollowRelation();
      refetchFollowCounts();
      refetchAccess();
      queryClient.invalidateQueries({ queryKey: ['follow-counts', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: any) =>
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo actualizar el seguimiento'),
  });

  const blockPlayerMutation = useMutation({
    mutationFn: () => api.post(`/reports/block/${targetUserId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-nearby-players'] });
      queryClient.invalidateQueries({ queryKey: ['player-profile'] });
      queryClient.invalidateQueries({ queryKey: ['home-open-matches'] });
      queryClient.invalidateQueries({ queryKey: ['matches-open'] });
      queryClient.invalidateQueries({ queryKey: ['open-matches'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
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

  if (playerError) {
    const status = (playerQueryError as any)?.response?.status;
    return (
      <Screen>
        <StackHeader title="Jugador" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: ui.colors.textPrimary, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
            {status === 403 ? 'Perfil no disponible' : 'No se pudo cargar el perfil'}
          </Text>
          <Text style={{ color: ui.colors.textMuted, marginTop: 8, textAlign: 'center' }}>
            {status === 403
              ? 'No podés ver el perfil de este jugador.'
              : 'Intentá de nuevo más tarde.'}
          </Text>
          <PrimaryButton label="Volver" onPress={() => router.back()} style={{ marginTop: 20 }} />
        </View>
      </Screen>
    );
  }

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

  const skillScore = resolveSkillScore(player.skillScore, player.rating);
  const levelCategory = player.levelCategory;
  const declaredCategory = player.declaredCategory;
  const isInPlacement = player.categoryStatus === 'provisional';
  const placementMatchesPlayed = Number(player.placementMatchesPlayed ?? 0);
  const placementMatchesRequired = Number(player.placementMatchesRequired ?? 5);
  const competitive = player.competitiveMonthly;
  const locationLabel = player.location || player.city || null;
  const subtitleParts = [locationLabel, 'Jugador'].filter(Boolean);
  const locationLine = subtitleParts.join(' · ');
  const playerAge = player.birthDate
    ? ageFromBirthDate(new Date(player.birthDate))
    : null;

  return (
    <Screen>
      <StackHeader title="Perfil" />
      <ScrollView
        contentContainerStyle={{
          ...tabScreenPadding,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInUp index={0}>
          <AppCard style={{ marginBottom: ui.spacing.md, backgroundColor: CARD_BG }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
              <TouchableOpacity
                onPress={() => player.photo_url && setShowPhotoViewer(true)}
                disabled={!player.photo_url}
                activeOpacity={0.9}
              >
                {player.photo_url ? (
                  <Avatar name={player.name} photo={player.photo_url} size="xl" style={{ marginBottom: 0 }} />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: '#2A2A2A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="person" size={36} color="#6B6B6B" />
                  </View>
                )}
              </TouchableOpacity>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    fontFamily: fontFamily.regular,
                    color: ui.colors.textPrimary,
                    lineHeight: 28,
                  }}
                >
                  {player.name}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: MUTED,
                    marginTop: 4,
                    fontFamily: fontFamily.regular,
                  }}
                  numberOfLines={2}
                >
                  {locationLine}
                </Text>
                <CircuitRoleBadges userId={targetUserId} />
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 18,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center' }}
                activeOpacity={0.75}
                onPress={() =>
                  router.push({
                    pathname: `/follows/${targetUserId}` as any,
                    params: { tab: 'followers', name: player.name },
                  })
                }
              >
                <Text style={{ fontSize: 15, color: ui.colors.textPrimary, fontFamily: fontFamily.regular }}>
                  <Text style={{ fontWeight: '700' }}>{followCounts?.followers ?? 0}</Text>
                  {'  '}
                  <Text style={{ color: MUTED }}>Seguidores</Text>
                </Text>
              </TouchableOpacity>
              <View style={{ width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center' }}
                activeOpacity={0.75}
                onPress={() =>
                  router.push({
                    pathname: `/follows/${targetUserId}` as any,
                    params: { tab: 'following', name: player.name },
                  })
                }
              >
                <Text style={{ fontSize: 15, color: ui.colors.textPrimary, fontFamily: fontFamily.regular }}>
                  <Text style={{ fontWeight: '700' }}>{followCounts?.following ?? 0}</Text>
                  {'  '}
                  <Text style={{ color: MUTED }}>Seguidos</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </AppCard>
        </FadeInUp>

        {!isSelf && user ? (
          <FadeInUp index={1}>
            <View style={{ marginBottom: ui.spacing.md, gap: 10 }}>
              {!isClubAccount ? (
                <LimeButton
                  label={followRelation?.following ? 'Siguiendo' : 'Seguir'}
                  onPress={() => followMutation.mutate()}
                  loading={followMutation.isPending}
                  icon={
                    <Ionicons
                      name={followRelation?.following ? 'checkmark' : 'person-add-outline'}
                      size={16}
                      color="#000"
                    />
                  }
                />
              ) : null}

              {isPlayer(user.role) ? (
                <PrimaryButton
                  label="Desafiar"
                  variant="outline"
                  onPress={openChallenge}
                  fullWidth
                  size="md"
                  icon={<Ionicons name="flash" size={18} color={ui.colors.primary} />}
                />
              ) : null}

              {messageAccess?.canMessage ? (
                <PrimaryButton
                  label="Enviar mensaje"
                  onPress={openChat}
                  loading={actionLoading}
                  fullWidth
                  size="md"
                  icon={<Ionicons name="chatbubble-outline" size={18} color={ui.colors.onPrimary} />}
                />
              ) : null}
              {messageAccess?.reason === 'pending_outgoing' ? (
                <Text style={{ fontSize: 13, color: MUTED, textAlign: 'center' }}>
                  Solicitud de mensaje enviada. Esperá a que {player.name.split(' ')[0]} la acepte.
                </Text>
              ) : null}
              {messageAccess?.reason === 'pending_incoming' ? (
                <PrimaryButton
                  label="Aceptar solicitud de mensaje"
                  onPress={() => {
                    queryClient.invalidateQueries({ queryKey: ['conversations-pending'] });
                    router.push('/(tabs)/messages' as any);
                  }}
                  fullWidth
                  size="md"
                />
              ) : null}
              {(messageAccess?.reason === 'need_request' || messageAccess?.canSendRequest) &&
              !messageAccess?.canMessage ? (
                <PrimaryButton
                  label="Solicitar enviar mensaje"
                  onPress={() => requestMessageMutation.mutate()}
                  loading={requestMessageMutation.isPending}
                  fullWidth
                  size="md"
                  variant="ghost"
                  style={{ backgroundColor: ui.colors.surfaceAlt }}
                />
              ) : null}
            </View>
          </FadeInUp>
        ) : null}

        <FadeInUp index={2}>
          <AppCard
            style={{
              marginBottom: ui.spacing.md,
              backgroundColor: CARD_BG,
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'relative', minHeight: 118 }}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -24,
                  top: -20,
                  bottom: -20,
                  width: 200,
                }}
              >
                <LevelStripes width={200} height={180} />
              </View>

              <Text
                style={{
                  fontSize: 11,
                  letterSpacing: 1.2,
                  fontWeight: '700',
                  color: MUTED,
                  fontFamily: fontFamily.regular,
                  marginBottom: 8,
                }}
              >
                TU NIVEL
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: ui.colors.textPrimary,
                  fontFamily: fontFamily.regular,
                  marginBottom: 12,
                  maxWidth: '70%',
                }}
              >
                {isInPlacement ? 'Nivel en nivelación' : 'Nivel actual'}
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: LIME,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    color: '#000',
                    fontSize: 13,
                    fontWeight: '700',
                    fontFamily: fontFamily.regular,
                  }}
                >
                  {formatSkillScore(skillScore)}
                  {levelCategory || declaredCategory ? `.${levelCategory || declaredCategory}` : ''}
                </Text>
              </View>
              {isInPlacement ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: MUTED,
                    lineHeight: 18,
                    fontFamily: fontFamily.regular,
                    maxWidth: '92%',
                  }}
                >
                  En nivelación: {Math.min(placementMatchesPlayed, placementMatchesRequired)}/
                  {placementMatchesRequired} partidos completados con resultado confirmado para
                  confirmar su categoría real.
                </Text>
              ) : declaredCategory ? (
                <Text style={{ fontSize: 12, color: MUTED, fontFamily: fontFamily.regular }}>
                  Categoría: {declaredCategory}
                </Text>
              ) : null}
            </View>
          </AppCard>
        </FadeInUp>

        <FadeInUp index={3}>
          <LinearGradient
            colors={['rgba(215, 255, 0, 0.58)', 'rgba(248, 255, 210, 0.58)']}
            start={{ x: 0.02, y: 0.48 }}
            end={{ x: 0.98, y: 0.52 }}
            style={{
              borderRadius: ui.radius.lg,
              padding: 1,
              marginBottom: ui.spacing.md,
            }}
          >
            <View
              style={{
                backgroundColor: CARD_BG,
                borderRadius: ui.radius.lg - 1,
                padding: ui.spacing.lg,
                overflow: 'hidden',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: ui.colors.textPrimary,
                  fontFamily: fontFamily.regular,
                  marginBottom: 14,
                }}
              >
                Puntos competitivos (
                {competitive?.monthKey ?? new Date().toISOString().slice(0, 7)})
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <CircularProgressRing
                  value={Number(competitive?.points ?? 0)}
                  maxValue={100}
                  size={72}
                  strokeWidth={8}
                  color={LIME}
                  trackColor="rgba(255,255,255,0.12)"
                />
                <Text style={{ fontSize: 14, color: MUTED, fontFamily: fontFamily.regular }}>
                  pts · {competitive?.matchesPlayed ?? 0} partidos
                </Text>
              </View>
            </View>
          </LinearGradient>
        </FadeInUp>

        <FadeInUp index={4}>
          <TournamentTitlesCard
            playerId={targetUserId}
            isSelf={isSelf}
            style={{ marginBottom: ui.spacing.md }}
          />
        </FadeInUp>

        <FadeInUp index={4}>
          <AppCard style={{ marginBottom: ui.spacing.md, backgroundColor: CARD_BG }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: ui.colors.textPrimary,
                fontFamily: fontFamily.regular,
                marginBottom: 12,
              }}
            >
              Club principal
            </Text>
            {player.mainClub?.name ? (
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: ui.colors.textPrimary,
                    fontFamily: fontFamily.regular,
                  }}
                  numberOfLines={2}
                >
                  {player.mainClub.name}
                </Text>
                {player.mainClub.city || player.mainClub.location ? (
                  <Text style={{ fontSize: 12, color: MUTED }} numberOfLines={1}>
                    {player.mainClub.city || player.mainClub.location}
                  </Text>
                ) : null}
                {player.mainClubId ? (
                  <PrimaryButton
                    label="Ver club"
                    variant="outline"
                    fullWidth
                    size="sm"
                    onPress={() => router.push(`/club/${player.mainClubId}` as any)}
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </View>
            ) : (
              <Text style={{ fontSize: 14, color: MUTED, fontFamily: fontFamily.regular }}>
                Sin club principal
              </Text>
            )}
          </AppCard>
        </FadeInUp>

        {player.bio ? (
          <AppCard style={{ marginBottom: ui.spacing.md, backgroundColor: CARD_BG }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: ui.colors.textPrimary,
                fontFamily: fontFamily.regular,
                marginBottom: 8,
              }}
            >
              Bio
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, lineHeight: 20, fontFamily: fontFamily.regular }}>
              {player.bio}
            </Text>
          </AppCard>
        ) : null}

        <FadeInUp index={5}>
          <AppCard style={{ marginBottom: ui.spacing.md, backgroundColor: CARD_BG }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: ui.colors.textPrimary,
                fontFamily: fontFamily.regular,
                marginBottom: 4,
              }}
            >
              Detalles
            </Text>
            <DetailRow label="Posición" value={formatPositionLabel(player.position)} />
            <DetailRow label="Mano" value={formatHandLabel(player.preferredHand)} />
            <DetailRow label="Género" value={formatGenderLabel(player.gender)} />
            <DetailRow
              label="Edad"
              value={playerAge != null ? `${playerAge} años` : 'No informada'}
            />
            <DetailRow label="Ubicación" value={locationLabel || 'No definida'} />
            <DetailRow
              label="Categoría inicial"
              value={declaredCategory || 'No informada'}
            />
            {isInPlacement ? (
              <Text
                style={{
                  fontSize: 12,
                  color: MUTED,
                  marginTop: 6,
                  fontFamily: fontFamily.regular,
                }}
              >
                En nivelación · {Math.min(placementMatchesPlayed, placementMatchesRequired)}/
                {placementMatchesRequired} partidos
              </Text>
            ) : null}
          </AppCard>
        </FadeInUp>

        <View style={{ marginBottom: ui.spacing.md, gap: 12 }}>
          <PlayerMatchStatsCard stats={player.matchStats} title="Resumen de partidos" />
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
