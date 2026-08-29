import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Linking,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { mapMatch } from '@/lib/mappers';
import { formatRelativeTime, formatCurrency } from '@/lib/format';
import { formatSkillRange, resolveSkillScore } from '@/lib/skill';
import { isClub } from '@/lib/roles';
import { markDepositPaid } from '@/lib/shop-api';
import { buildMatchShareMessage, invitePlayersToMatch } from '@/lib/match-share';
import type { InvitedPlayer, PlayerMatchRating, SetScore } from '@/lib/types';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  StatusPill,
  PrimaryButton,
  Avatar,
  PlayerRatingSection,
  MatchResultComposer,
  SkillProgress,
  buildPlayerRatingsPayload,
  PlayerInvitePicker,
  buildMatchInvitesPayload,
  MatchOrganizedSummary,
} from '@/components/padely';
import { MatchShopExtras } from '@/components/shop/MatchShopExtras';

const FREE_CANCEL_WINDOW_MS = 30 * 60 * 1000;

function isWithinFreeCancelWindow(createdAt?: string) {
  if (!createdAt) return false;
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return false;
  return Date.now() - createdMs < FREE_CANCEL_WINDOW_MS;
}

function depositCancelHint(createdAt?: string, hasPaidDeposit?: boolean) {
  if (!hasPaidDeposit) return 'Las señas pendientes se anulan.';
  return isWithinFreeCancelWindow(createdAt)
    ? 'Todavía estás dentro de los 30 minutos: la seña pagada se reembolsa.'
    : 'Pasaron más de 30 minutos desde la creación/alquiler: la seña pagada se retiene.';
}

function userTeamFromRank(rnk: number, neededPlayers: number): 'A' | 'B' {
  const half = Math.ceil(Math.max(neededPlayers, 2) / 2);
  return rnk <= half ? 'A' : 'B';
}

function resolveSlotOrder(slotOrder: number | undefined, fallbackIndex: number) {
  return slotOrder ?? fallbackIndex + 1;
}

function getRivalPlayers(
  players: { id: string; name: string; photo?: string; slotOrder?: number }[],
  currentUserId: string | undefined,
  neededPlayers: number,
) {
  if (!currentUserId) return [];
  const ordered = [...players].sort(
    (a, b) => resolveSlotOrder(a.slotOrder, 999) - resolveSlotOrder(b.slotOrder, 999),
  );
  const currentIndex = ordered.findIndex((p) => p.id === currentUserId);
  if (currentIndex < 0) return [];
  const current = ordered[currentIndex];
  const myTeam = userTeamFromRank(resolveSlotOrder(current.slotOrder, currentIndex), neededPlayers);
  return ordered.filter(
    (p, i) =>
      p.id !== currentUserId &&
      userTeamFromRank(resolveSlotOrder(p.slotOrder, i), neededPlayers) !== myTeam,
  );
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [confirmRatings, setConfirmRatings] = useState<Record<string, number>>({});
  const [rivalRatings, setRivalRatings] = useState<Record<string, number>>({});
  const [invitePartner, setInvitePartner] = useState<InvitedPlayer | null>(null);
  const [inviteOpponents, setInviteOpponents] = useState<InvitedPlayer[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const { data: matchRaw, isLoading, refetch } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => {
      const res = await api.get(`/matches/${id}`);
      return res.data;
    },
  });

  const match = matchRaw ? mapMatch(matchRaw) : null;
  const isClubAccount = isClub(user?.role);
  const isChatEnabled =
    match &&
    !isClubAccount &&
    ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS', 'FINISHED', 'DISPUTED'].includes(match.status);

  const { data: chatMessages } = useQuery({
    queryKey: ['chat-messages', id],
    queryFn: async () => {
      const res = await api.get(`/matches/${id}/messages`);
      return res.data;
    },
    enabled: !!isChatEnabled,
  });

  useEffect(() => {
    if (chatMessages) setMessages(chatMessages);
  }, [chatMessages]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const joinMutation = useMutation({
    mutationFn: () => api.post(`/matches/${id}/join`),
    onSuccess: (response) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      const updated = mapMatch(response.data);
      if (updated.viewerJoinStatus === 'REQUESTED') {
        Alert.alert(
          'Solicitud enviada',
          'Tu nivel no coincide con el rango del partido. El organizador o los jugadores deben aceptarte.',
        );
      } else {
        Alert.alert('Listo', 'Te uniste al partido.');
      }
    },
    onError: (error: any) => Alert.alert('Error', error?.response?.data?.message || 'Error al unirte'),
  });

  const cancelJoinRequestMutation = useMutation({
    mutationFn: () => api.post(`/matches/${id}/leave`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      Alert.alert('Solicitud cancelada', 'Ya no estás en la lista de solicitudes.');
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo cancelar la solicitud'),
  });

  const leaveMatchMutation = useMutation({
    mutationFn: () => api.post(`/matches/${id}/leave`),
    onSuccess: (response) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      const data = response.data;
      const policy = data?.depositPolicy;
      if (data?.cancelled) {
        const detail =
          policy?.retained > 0
            ? 'Eras el único jugador: el partido se canceló y tu seña se retuvo.'
            : policy?.refunded > 0
              ? 'Eras el único jugador: el partido se canceló y tu seña se reembolsa.'
              : 'Eras el único jugador: el partido se canceló.';
        Alert.alert('Partido cancelado', detail);
        return;
      }
      const transferHint = data?.organizerTransferred
        ? data.newOrganizerName
          ? ` La organización pasó a ${data.newOrganizerName}.`
          : ' La organización pasó al siguiente jugador.'
        : '';
      const detail =
        policy?.retained > 0
          ? `Saliste del partido. Tu seña se retuvo porque pasaron más de 30 minutos.${transferHint}`
          : policy?.refunded > 0
            ? `Saliste del partido. Tu seña será reembolsada.${transferHint}`
            : `Saliste del partido.${transferHint}`;
      Alert.alert('Listo', detail.trim());
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo salir del partido'),
  });

  const cancelMatchMutation = useMutation({
    mutationFn: () => api.post(`/matches/${id}/cancel`),
    onSuccess: (response) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      const policy = response.data?.depositPolicy;
      const detail =
        policy?.retained > 0
          ? 'Partido cancelado. Las señas pagadas se retuvieron (más de 30 minutos).'
          : policy?.refunded > 0
            ? 'Partido cancelado. Las señas pagadas se reembolsan.'
            : 'Partido cancelado.';
      Alert.alert('Partido cancelado', detail);
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo cancelar el partido'),
  });

  const acceptJoinRequestMutation = useMutation({
    mutationFn: (requestUserId: string) => api.post(`/matches/${id}/join-requests/${requestUserId}/accept`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      Alert.alert('Jugador aceptado', 'Ya forma parte del partido.');
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo aceptar la solicitud'),
  });

  const rejectJoinRequestMutation = useMutation({
    mutationFn: (requestUserId: string) => api.post(`/matches/${id}/join-requests/${requestUserId}/reject`),
    onSuccess: () => {
      refetch();
      Alert.alert('Solicitud rechazada', 'El jugador fue notificado.');
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo rechazar la solicitud'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/matches/${id}/confirm`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      Alert.alert('Confirmado', 'Tu asistencia quedó confirmada.');
    },
    onError: (error: any) => Alert.alert('Error', error?.response?.data?.message || 'No se pudo confirmar'),
  });

  const submitResultMutation = useMutation({
    mutationFn: async ({ sets, playerRatings }: { sets: SetScore[]; playerRatings: PlayerMatchRating[] }) => {
      const res = await api.post(`/matches/${id}/result`, {
        sets,
        playerRatings: playerRatings.length ? playerRatings : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      Alert.alert(
        'Resultado propuesto',
        'Los demás jugadores tienen 48 horas para confirmar. Si no hay acuerdo, el partido cierra sin puntos y podrás dejar reseñas a tus rivales.',
      );
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      Alert.alert(
        'Error',
        Array.isArray(msg) ? msg.join('\n') : msg || error.message || 'Error al cargar resultado',
      );
    },
  });

  const rejectResultMutation = useMutation({
    mutationFn: () => api.post(`/matches/${id}/result/reject`),
    onSuccess: () => {
      refetch();
      Alert.alert(
        'Rechazo registrado',
        'No confirmamos este marcador. Podés proponer el resultado correcto con "Proponer otro resultado". Si no hay acuerdo en 48 h, el partido cierra sin puntos.',
      );
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo registrar el rechazo'),
  });

  const rivalReviewsMutation = useMutation({
    mutationFn: () => {
      const playerRatings = buildPlayerRatingsPayload(rivalRatings);
      return api.post(`/matches/${id}/rival-reviews`, {
        playerRatings: playerRatings.length ? playerRatings : undefined,
      });
    },
    onSuccess: () => {
      refetch();
      setRivalRatings({});
      Alert.alert('Listo', 'Tus reseñas a rivales quedaron guardadas.');
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudieron guardar las reseñas'),
  });

  const confirmResultMutation = useMutation({
    mutationFn: async () => {
      const playerRatings = buildPlayerRatingsPayload(confirmRatings);
      const res = await api.post(`/matches/${id}/result/confirm`, {
        playerRatings: playerRatings.length ? playerRatings : undefined,
      });
      return res.data;
    },
    onSuccess: (data: { finalized?: boolean }) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      Alert.alert(
        data.finalized ? 'Resultado confirmado' : 'Confirmación registrada',
        data.finalized
          ? 'Todos confirmaron. El partido quedó cerrado y se actualizaron los puntos.'
          : 'Falta la confirmación de otros jugadores para cerrar el partido.',
      );
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo confirmar el resultado'),
  });

  const depositCheckoutMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/matches/${id}/deposit/checkout`);
      return res.data;
    },
    onSuccess: async (data) => {
      if (data.paid || !data.required) {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['my-matches'] });
        Alert.alert('Listo', 'Tu asistencia quedó confirmada.');
        return;
      }

      if (data.mock) {
        Alert.alert(
          'Pagar seña (modo prueba)',
          `Seña: ${formatCurrency(data.amount, data.currency || 'ARS')}\n\nEn producción se abre Mercado Pago.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Simular pago',
              onPress: async () => {
                try {
                  await api.post(`/matches/${id}/deposit/simulate`);
                  refetch();
                  queryClient.invalidateQueries({ queryKey: ['my-matches'] });
                  Alert.alert('Listo', 'Seña acreditada y asistencia confirmada.');
                } catch (e: any) {
                  Alert.alert('Error', e?.response?.data?.message || 'No se pudo simular el pago');
                }
              },
            },
          ],
        );
        return;
      }

      if (data.checkoutUrl) {
        const canOpen = await Linking.canOpenURL(data.checkoutUrl);
        if (canOpen) {
          await Linking.openURL(data.checkoutUrl);
        } else {
          Alert.alert('Error', 'No se pudo abrir la pasarela de pago');
        }
      }
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo iniciar el pago de la seña'),
  });

  const markDepositPaidMutation = useMutation({
    mutationFn: ({ depositId, clubId: payClubId }: { depositId: string; clubId: string }) =>
      markDepositPaid(payClubId, depositId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['match', id] }),
        queryClient.invalidateQueries({ queryKey: ['club-billing-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['club-profile-revenue'] }),
        queryClient.invalidateQueries({ queryKey: ['club-manager-report'] }),
      ]);
      Alert.alert('Listo', 'Seña marcada como pagada en recepción.');
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo marcar la seña como pagada'),
  });

  const invitePlayersMutation = useMutation({
    mutationFn: (invites: ReturnType<typeof buildMatchInvitesPayload>) =>
      invitePlayersToMatch(id!, invites),
    onSuccess: () => {
      setInvitePartner(null);
      setInviteOpponents([]);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      Alert.alert('Invitaciones enviadas', 'Los jugadores ya forman parte del partido.');
    },
    onError: (error: any) =>
      Alert.alert('Error', error?.response?.data?.message || 'No se pudieron agregar los invitados'),
  });

  const shareMatchLink = async () => {
    if (!match) return;
    try {
      await Share.share({
        message: buildMatchShareMessage(match),
        title: match.title,
      });
    } catch {
      // usuario canceló
    }
  };

  const sendMessage = async () => {
    if (!chatMessage.trim()) return;
    try {
      const res = await api.post(`/matches/${id}/messages`, { content: chatMessage.trim() });
      setMessages((prev) => [...prev, res.data]);
      setChatMessage('');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  if (isLoading || !match) {
    return (
      <Screen>
        <StackHeader title="Partido" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: ui.colors.textMuted }}>{isLoading ? 'Cargando...' : 'Partido no encontrado'}</Text>
        </View>
      </Screen>
    );
  }

  const isParticipant = match.players.some((p) => p.id === user?.id);
  const hasPendingJoinRequest = match.viewerJoinStatus === 'REQUESTED';
  const joinRequiresApproval = !!match.joinRequiresApproval;
  const canJoin =
    match.status === 'OPEN' &&
    match.joinedCount < match.neededPlayers &&
    !isParticipant &&
    !hasPendingJoinRequest;
  const canManageJoinRequests =
    !isClubAccount &&
    (match.createdByUserId === user?.id || isParticipant) &&
    (match.joinRequests?.length ?? 0) > 0;
  const myPlayer = match.players.find((p) => p.id === user?.id);
  const isOrganizer = match.createdByUserId === user?.id;
  const otherPlayersCount = match.players.filter((p) => p.id !== user?.id).length;
  const canLeaveMatch =
    !isClubAccount &&
    !hasPendingJoinRequest &&
    isParticipant &&
    !!myPlayer &&
    ['JOINED', 'CONFIRMED'].includes(myPlayer.status || 'JOINED') &&
    ['OPEN', 'FULL', 'CONFIRMED'].includes(match.status);
  const canCancelMatch =
    (isOrganizer || isClubAccount) &&
    ['OPEN', 'FULL', 'CONFIRMED'].includes(match.status);
  const hasPaidDeposit = !!match.deposit?.paid;
  const isDisputed = match.status === 'DISPUTED';
  const canSubmitResult =
    isParticipant &&
    !isDisputed &&
    (match.status === 'FULL' || match.status === 'CONFIRMED' || match.status === 'IN_PROGRESS') &&
    match.result?.status !== 'confirmed';
  const rivalPlayers = getRivalPlayers(match.players, user?.id, match.neededPlayers);
  const canSubmitRivalReviews = isParticipant && !!match.canSubmitRivalReviews;
  const pendingResult = match.result?.status === 'pending';
  const myResultConfirmed = match.result?.confirmations?.some((c) => c.userId === user?.id);
  const myResultRejected = match.result?.rejections?.some((r) => r.userId === user?.id);
  const isResultSubmitter = match.result?.submittedByUserId === user?.id;
  const canConfirmResult =
    isParticipant && pendingResult && !myResultConfirmed && !myResultRejected && !isResultSubmitter;
  const canRejectResult =
    isParticipant && pendingResult && !myResultConfirmed && !myResultRejected && !isResultSubmitter;
  const canProposeAlternative =
    isParticipant &&
    pendingResult &&
    !isResultSubmitter &&
    (myResultRejected || !myResultConfirmed) &&
    (match.status === 'FULL' || match.status === 'IN_PROGRESS' || match.status === 'CONFIRMED');
  const canProposeNewResult =
    isParticipant &&
    pendingResult &&
    isResultSubmitter &&
    (match.status === 'FULL' || match.status === 'IN_PROGRESS' || match.status === 'CONFIRMED');
  const canComposeResult = (canSubmitResult && !pendingResult) || canProposeAlternative || canProposeNewResult;
  const showChatBtn = isParticipant && !isClubAccount && !['CANCELLED'].includes(match.status);
  const needsConfirm =
    isParticipant && ['OPEN', 'FULL'].includes(match.status) && myPlayer?.status === 'JOINED';
  const deposit = match.deposit;
  const depositPlayers = deposit?.players ?? [];
  const orderedPlayers = [...match.players].sort(
    (a, b) => resolveSlotOrder(a.slotOrder, 999) - resolveSlotOrder(b.slotOrder, 999),
  );
  const occupiedSlots = [
    ...orderedPlayers.map((player) => ({ ...player, kind: 'player' as const })),
    ...((match.guestInvites ?? []).map((guest) => ({
      ...guest,
      photo: undefined,
      kind: 'guest' as const,
    })) || []),
  ].sort((a, b) => resolveSlotOrder(a.slotOrder, 999) - resolveSlotOrder(b.slotOrder, 999));
  const needsDepositPayment =
    needsConfirm && deposit?.required && !deposit?.paid;
  const canConfirmWithoutPay = needsConfirm && (!deposit?.required || deposit?.paid);
  const clubId = match.clubId || match.club?.id;
  const canAddShopExtras =
    isParticipant && !!clubId && ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS'].includes(match.status);
  const resultComposerTitle = canProposeAlternative
    ? 'Proponer otro resultado'
    : canProposeNewResult
      ? 'Actualizar mi propuesta'
      : 'Completar resultado';
  const resultComposerSubmitLabel = canProposeAlternative
    ? 'Enviar nueva propuesta'
    : canProposeNewResult
      ? 'Guardar propuesta'
      : 'Guardar resultado';
  const resultComposerSubtitle =
    'Cargá el marcador final y, si querés, dejá reseñas opcionales a los jugadores que elijas.';
  const hasResultScore = !!(
    match.result?.score ||
    (match.result?.sets && match.result.sets.length > 0)
  );
  const showResultSection =
    hasResultScore ||
    ['FULL', 'CONFIRMED', 'IN_PROGRESS', 'FINISHED', 'DISPUTED'].includes(match.status);
  const hasFooterActions =
    canJoin ||
    hasPendingJoinRequest ||
    needsDepositPayment ||
    canConfirmWithoutPay ||
    canConfirmResult ||
    canRejectResult ||
    canLeaveMatch ||
    canCancelMatch;
  const openSlots = Math.max(0, match.neededPlayers - match.joinedCount);
  const canInvitePlayers =
    !isClubAccount &&
    isParticipant &&
    openSlots > 0 &&
    ['OPEN', 'FULL'].includes(match.status);
  const pendingInvitePayload = buildMatchInvitesPayload(invitePartner, inviteOpponents);
  const canSubmitInvites =
    canInvitePlayers &&
    pendingInvitePayload.length > 0 &&
    pendingInvitePayload.length <= openSlots;

  const sharePaymentLink = async () => {
    const checkoutUrl = deposit?.checkoutUrl?.trim();
    if (!checkoutUrl) {
      depositCheckoutMutation.mutate();
      return;
    }
    try {
      await Share.share({
        message: `Pagá la seña del partido "${match.title}" para confirmar la cancha:\n${checkoutUrl}`,
        title: 'Link de pago · seña de cancha',
        url: checkoutUrl,
      });
    } catch {
      // usuario canceló
    }
  };

  const getGenderLabel = (g?: string) => {
    const labels: Record<string, string> = { male: 'Masculino', female: 'Femenino', mixed: 'Mixto', open: 'Abierto' };
    return labels[g || ''] || g;
  };

  return (
    <Screen>
      <StackHeader
        title={showChat ? 'Chat' : 'Detalle del partido'}
        rightAction={
          showChatBtn ? (
            <TouchableOpacity onPress={() => setShowChat(!showChat)} style={{ padding: 8 }}>
              <Ionicons name="chatbubble-outline" size={22} color={showChat ? ui.colors.primary : ui.colors.textInverse} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {showChat ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} style={{ flex: 1, padding: ui.spacing.lg }} onContentSizeChange={() => scrollRef.current?.scrollToEnd()}>
            {messages.length === 0 ? (
              <Text style={{ textAlign: 'center', color: ui.colors.textMuted, marginTop: 40 }}>No hay mensajes aún</Text>
            ) : (
              messages.map((msg: any) => {
                const isOwn = msg.userId === user?.id || msg.user_id === user?.id;
                return (
                  <View key={msg.id} style={{ flexDirection: 'row', marginBottom: 12, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                    {!isOwn && <Avatar name={msg.userName || msg.user_name || '?'} size="sm" style={{ marginRight: 8 }} />}
                    <View
                      style={{
                        maxWidth: '75%',
                        backgroundColor: isOwn ? ui.colors.primary : ui.colors.surface,
                        borderRadius: ui.radius.md,
                        padding: 10,
                      }}
                    >
                      <Text style={{ color: isOwn ? '#fff' : ui.colors.textInverse, fontSize: 14 }}>{msg.content}</Text>
                      <Text style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.7)' : ui.colors.textMuted, marginTop: 4 }}>
                        {formatRelativeTime(msg.createdAt || msg.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', padding: ui.spacing.lg, gap: 8, borderTopWidth: 1, borderTopColor: ui.colors.surfaceAlt }}>
            <TextInput
              value={chatMessage}
              onChangeText={setChatMessage}
              placeholder="Escribí un mensaje..."
              placeholderTextColor={ui.colors.textMuted}
              style={{
                flex: 1,
                backgroundColor: ui.colors.surface,
                borderRadius: ui.radius.pill,
                paddingHorizontal: 16,
                paddingVertical: 10,
                color: ui.colors.textInverse,
              }}
            />
            <TouchableOpacity
              onPress={sendMessage}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ui.colors.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: hasFooterActions ? 200 : 120 }}>
            <AppCard>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary, flex: 1 }}>
                  {match.title}
                </Text>
                <StatusPill status={match.status} size="md" />
              </View>
              {match.status === 'CANCELLED' ? (
                <Text style={{ fontSize: 13, color: ui.colors.danger, marginBottom: 12, fontWeight: '600' }}>
                  Este partido fue cancelado.
                </Text>
              ) : null}
              <MatchOrganizedSummary match={match} />
              {match.description && match.courtBooking !== 'in_app' ? (
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 12 }}>
                  {match.description}
                </Text>
              ) : null}
              {match.levelMin != null && match.levelMax != null && (
                <Text style={{ fontSize: 12, color: ui.colors.primary, marginTop: 10, fontWeight: '600' }}>
                  {formatSkillRange(match.levelMin, match.levelMax)}
                </Text>
              )}
            </AppCard>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: ui.spacing.sm }}>
              <AppCard style={{ flex: 1, marginBottom: 0 }} padding="sm">
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary, textAlign: 'center' }}>Modo</Text>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, textAlign: 'center', marginTop: 4 }}>
                  {match.mode === 'competitive' ? 'Competitivo' : 'Amistoso'}
                </Text>
              </AppCard>
              <AppCard style={{ flex: 1, marginBottom: 0 }} padding="sm">
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary, textAlign: 'center' }}>Género</Text>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, textAlign: 'center', marginTop: 4 }}>
                  {getGenderLabel(match.gender)}
                </Text>
              </AppCard>
            </View>

            <AppCard>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 12 }}>
                Jugadores ({match.joinedCount}/{match.neededPlayers})
              </Text>
              {occupiedSlots.map((player) =>
                player.kind === 'player' ? (
                  <TouchableOpacity
                    key={player.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}
                    onPress={() => router.push(`/player/${player.id}` as any)}
                  >
                    <Avatar name={player.name} photo={player.photo} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{player.name}</Text>
                      <SkillProgress
                        score={resolveSkillScore(player.skillScore, player.rating)}
                        category={player.levelCategory}
                        size="sm"
                        label="Nivel"
                      />
                    </View>
                    {player.id === user?.id && (
                      <Text style={{ fontSize: 11, color: ui.colors.primary, fontWeight: '700' }}>Vos</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View key={player.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Avatar name={player.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{player.name}</Text>
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                        Invitado externo
                        {player.sponsorUserId === user?.id ? ' · cubierto por vos' : ''}
                      </Text>
                    </View>
                  </View>
                ),
              )}
              {Array.from({ length: match.neededPlayers - match.joinedCount }).map((_, i) => (
                <View key={`empty-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.5, marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: ui.colors.textMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: ui.colors.textMuted }}>?</Text>
                  </View>
                  <Text style={{ color: ui.colors.textMuted }}>Esperando jugador...</Text>
                </View>
              ))}
            </AppCard>

            {canInvitePlayers && (
              <AppCard style={{ marginBottom: ui.spacing.sm }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 4 }}>
                  Completar el equipo
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 19 }}>
                  Compartí el link del partido o invitá jugadores de la app. Quedan {openSlots}{' '}
                  {openSlots === 1 ? 'lugar' : 'lugares'}.
                </Text>
                <PrimaryButton
                  label="Compartir link del partido"
                  onPress={shareMatchLink}
                  fullWidth
                  size="md"
                  variant="outline"
                  icon={<Ionicons name="share-outline" size={18} color={ui.colors.primary} />}
                  style={{ marginBottom: 12 }}
                />
                <PlayerInvitePicker
                  partner={invitePartner}
                  opponents={inviteOpponents}
                  onPartnerChange={setInvitePartner}
                  onOpponentsChange={setInviteOpponents}
                  excludeUserIds={[
                    ...(user?.id ? [user.id] : []),
                    ...match.players.map((player) => player.id),
                  ]}
                />
                {canSubmitInvites ? (
                  <PrimaryButton
                    label="Agregar invitados"
                    onPress={() => invitePlayersMutation.mutate(pendingInvitePayload)}
                    loading={invitePlayersMutation.isPending}
                    fullWidth
                    size="md"
                    style={{ marginTop: 4 }}
                  />
                ) : null}
              </AppCard>
            )}

            {match.courtBooking === 'in_app' && isParticipant && deposit?.required && !deposit?.paid && (
              <AppCard style={{ marginBottom: ui.spacing.sm, backgroundColor: 'rgba(245,158,11,0.08)' }}>
                <Text style={{ fontWeight: '700', color: ui.colors.accent, marginBottom: 6 }}>
                  Confirmar cancha reservada
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 19 }}>
                  Pagá la seña del club para liberar y confirmar el horario de la cancha
                  {deposit.clubName ? ` en ${deposit.clubName}` : ''}.
                </Text>
                <PrimaryButton
                  label={`Pagar seña${deposit.amount ? ` (${formatCurrency(deposit.amount, deposit.currency)})` : ''}`}
                  onPress={() => depositCheckoutMutation.mutate()}
                  loading={depositCheckoutMutation.isPending}
                  fullWidth
                  size="md"
                  icon={<Ionicons name="card" size={18} color="#fff" />}
                  style={{ marginBottom: deposit.checkoutUrl ? 8 : 0 }}
                />
                {deposit.checkoutUrl ? (
                  <PrimaryButton
                    label="Compartir link de pago"
                    onPress={sharePaymentLink}
                    fullWidth
                    size="md"
                    variant="outline"
                    icon={<Ionicons name="link-outline" size={18} color={ui.colors.primary} />}
                  />
                ) : null}
              </AppCard>
            )}

            {hasPendingJoinRequest && (
              <AppCard style={{ backgroundColor: 'rgba(245,158,11,0.1)', marginBottom: ui.spacing.sm }}>
                <Text style={{ fontWeight: '700', color: ui.colors.accent, marginBottom: 6 }}>
                  Solicitud pendiente
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 19 }}>
                  Tu nivel no coincide con el rango del partido. Esperá a que el organizador o los jugadores te
                  acepten.
                </Text>
              </AppCard>
            )}

            {canManageJoinRequests && (
              <AppCard style={{ marginBottom: ui.spacing.sm }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 4 }}>
                  Solicitudes para unirse
                </Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 12 }}>
                  Jugadores fuera del rango de nivel del partido
                </Text>
                {match.joinRequests?.map((request) => (
                  <View
                    key={request.userId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 12,
                      paddingBottom: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: ui.colors.border,
                    }}
                  >
                    <TouchableOpacity onPress={() => router.push(`/player/${request.userId}` as any)}>
                      <Avatar name={request.name} photo={request.photo} size="md" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{request.name}</Text>
                      <SkillProgress
                        score={request.skillScore}
                        size="sm"
                        label="Nivel"
                      />
                      {request.requestedAt ? (
                        <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>
                          {formatRelativeTime(request.requestedAt)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => acceptJoinRequestMutation.mutate(request.userId)}
                        disabled={acceptJoinRequestMutation.isPending || rejectJoinRequestMutation.isPending}
                        style={{
                          backgroundColor: ui.colors.primary,
                          borderRadius: ui.radius.sm,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Aceptar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => rejectJoinRequestMutation.mutate(request.userId)}
                        disabled={acceptJoinRequestMutation.isPending || rejectJoinRequestMutation.isPending}
                        style={{
                          borderWidth: 1,
                          borderColor: ui.colors.border,
                          borderRadius: ui.radius.sm,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: ui.colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                          Rechazar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </AppCard>
            )}

            {deposit?.required && (isParticipant || isClubAccount) && (
              <AppCard style={{ marginBottom: ui.spacing.sm }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 8 }}>
                  Seña de cancha
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 8 }}>
                  {deposit.clubName ? `${deposit.clubName} · ` : ''}
                  {formatCurrency(deposit.amount, deposit.currency)}
                  {deposit.coveredGuestSlots
                    ? ` total (${deposit.coveredGuestSlots + 1} lugares)`
                    : ' por jugador'}
                  {deposit.provider === 'MOCK' ? ' (modo prueba)' : ' · Mercado Pago'}
                </Text>
                {!!deposit.coveredGuests?.length && (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 8 }}>
                    Incluye a {deposit.coveredGuests.map((guest) => guest.name).join(', ')}
                  </Text>
                )}
                {isParticipant && deposit.paid ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={18} color={ui.colors.success} />
                    <Text style={{ color: ui.colors.success, fontWeight: '600' }}>Tu seña está paga</Text>
                  </View>
                ) : null}
                {isParticipant && !deposit.paid ? (
                  <Text style={{ fontSize: 12, color: ui.colors.warning, marginBottom: 8 }}>
                    Pagá la seña para confirmar cancha y horario
                  </Text>
                ) : null}
                {isClubAccount && !isParticipant ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                    Desde recepción podés marcar señas pendientes como cobradas.
                  </Text>
                ) : null}
                {depositPlayers.length > 0 && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {depositPlayers.map((p) => {
                      const pending = p.status === 'PENDING';
                      return (
                        <View key={p.userId || p.id} style={{ gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>{p.userName}</Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: p.status === 'APPROVED' ? ui.colors.success : ui.colors.danger,
                              }}
                            >
                              {p.status === 'APPROVED'
                                ? `Pagó seña${p.coveredGuestSlots ? ` (+${p.coveredGuestSlots} invitado${p.coveredGuestSlots > 1 ? 's' : ''})` : ''}`
                                : 'Pendiente'}
                            </Text>
                          </View>
                          {isClubAccount && pending && p.id && clubId ? (
                            <PrimaryButton
                              label="Marcar seña pagada"
                              size="sm"
                              loading={markDepositPaidMutation.isPending}
                              onPress={() => {
                                Alert.alert(
                                  'Confirmar cobro',
                                  `¿${p.userName} pagó la seña de ${formatCurrency(p.amount)}?`,
                                  [
                                    { text: 'Cancelar', style: 'cancel' },
                                    {
                                      text: 'Cobrado',
                                      onPress: () =>
                                        markDepositPaidMutation.mutate({
                                          depositId: p.id!,
                                          clubId,
                                        }),
                                    },
                                  ],
                                );
                              }}
                            />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </AppCard>
            )}

            {clubId && (
              <MatchShopExtras
                matchId={id!}
                clubId={clubId}
                currentUserId={user?.id}
                canAdd={canAddShopExtras}
                canConfirmPayments={isClubAccount}
              />
            )}

            {showResultSection && (
              <AppCard
                style={{
                  backgroundColor: hasResultScore
                    ? match.result?.status === 'confirmed'
                      ? 'rgba(22,163,74,0.08)'
                      : 'rgba(245,158,11,0.1)'
                    : ui.colors.surfaceAlt,
                }}
              >
                {hasResultScore && match.result ? (
                  <>
                    <Text
                      style={{
                        fontWeight: '700',
                        color:
                          match.result.status === 'confirmed' ? ui.colors.success : ui.colors.accent,
                        marginBottom: 8,
                      }}
                    >
                      {isDisputed
                        ? 'Sin acuerdo en el marcador'
                        : match.result.status === 'confirmed'
                          ? 'Resultado confirmado'
                          : 'Resultado pendiente'}
                    </Text>
                    <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 8 }}>
                      Al mejor de 3 sets · Equipo {match.result.winnerTeam === 'B' ? 'B' : 'A'} ganó el
                      partido
                    </Text>
                    {isDisputed && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: ui.colors.accent,
                          marginBottom: 8,
                          textAlign: 'center',
                        }}
                      >
                        Sin acuerdo en 48 h — no se asignaron puntos a ningún jugador
                      </Text>
                    )}
                    {pendingResult && match.result.confirmDeadlineAt && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: ui.colors.textMuted,
                          marginBottom: 8,
                          textAlign: 'center',
                        }}
                      >
                        Confirmar antes del{' '}
                        {new Date(match.result.confirmDeadlineAt).toLocaleString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: '800',
                        color: ui.colors.textPrimary,
                        textAlign: 'center',
                      }}
                    >
                      {match.result.score ||
                        match.result.sets?.map((s) => `${s.teamA}-${s.teamB}`).join(' · ')}
                    </Text>
                    {match.result.sets && match.result.sets.length > 0 && (
                      <View style={{ marginTop: 12, gap: 4 }}>
                        {match.result.sets.map((set, idx) => (
                          <Text
                            key={idx}
                            style={{
                              textAlign: 'center',
                              color: ui.colors.textSecondary,
                              fontSize: 13,
                            }}
                          >
                            Set {idx + 1}: {set.teamA} - {set.teamB}
                          </Text>
                        ))}
                      </View>
                    )}
                    {match.result.submittedByName && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: ui.colors.textMuted,
                          marginTop: 10,
                          textAlign: 'center',
                        }}
                      >
                        Propuesto por {match.result.submittedByName}
                      </Text>
                    )}
                    {pendingResult && (
                      <View style={{ marginTop: 14 }}>
                        {(match.result.rejections?.length ?? 0) > 0 && (
                          <View
                            style={{
                              backgroundColor: 'rgba(239,68,68,0.08)',
                              borderRadius: ui.radius.md,
                              padding: 10,
                              marginBottom: 12,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: ui.colors.danger,
                                marginBottom: 6,
                              }}
                            >
                              Hay desacuerdo con el marcador
                            </Text>
                            <Text
                              style={{ fontSize: 12, color: ui.colors.textSecondary, lineHeight: 18 }}
                            >
                              La otra pareja puede proponer otro resultado. Si no hay acuerdo en 48 h, el
                              partido cierra sin puntos y podrás reseñar a tus rivales.
                            </Text>
                          </View>
                        )}
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: ui.colors.textPrimary,
                            marginBottom: 8,
                          }}
                        >
                          Estado ({match.result.confirmations?.length ?? 0} confirmaron ·{' '}
                          {match.result.rejections?.length ?? 0} no coinciden)
                        </Text>
                        {orderedPlayers.map((player) => {
                          const confirmed = match.result?.confirmations?.some(
                            (c) => c.userId === player.id,
                          );
                          const rejected = match.result?.rejections?.some(
                            (r) => r.userId === player.id,
                          );
                          const isSubmitter = player.id === match.result?.submittedByUserId;
                          return (
                            <View
                              key={player.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 6,
                              }}
                            >
                              <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                                {player.name}
                                {isSubmitter ? ' (propuso)' : ''}
                              </Text>
                              {rejected ? (
                                <Ionicons name="close-circle" size={18} color={ui.colors.danger} />
                              ) : (
                                <Ionicons
                                  name={confirmed ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={18}
                                  color={confirmed ? ui.colors.success : ui.colors.textMuted}
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                    <Ionicons
                      name="clipboard-outline"
                      size={28}
                      color={ui.colors.textMuted}
                      style={{ marginBottom: 10 }}
                    />
                    <Text
                      style={{
                        fontWeight: '700',
                        color: ui.colors.textPrimary,
                        marginBottom: 6,
                        textAlign: 'center',
                      }}
                    >
                      Resultado no cargado
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: ui.colors.textSecondary,
                        textAlign: 'center',
                        lineHeight: 19,
                      }}
                    >
                      {match.status === 'FINISHED'
                        ? 'Este partido finalizó sin un marcador registrado.'
                        : canComposeResult
                          ? 'Todavía no hay marcador. Completá el resultado más abajo para que el resto lo confirme.'
                          : isParticipant
                            ? 'Todavía no se cargó el resultado. Cuando un jugador lo proponga, vas a poder confirmarlo acá.'
                            : 'Todavía no se cargó el resultado de este partido.'}
                    </Text>
                  </View>
                )}
              </AppCard>
            )}

            {canComposeResult && (
              <MatchResultComposer
                players={orderedPlayers.map((p) => ({ id: p.id, name: p.name, photo: p.photo }))}
                currentUserId={user?.id}
                initialSets={match.result?.sets}
                title={resultComposerTitle}
                subtitle={resultComposerSubtitle}
                submitLabel={resultComposerSubmitLabel}
                submitVariant="dark"
                loading={submitResultMutation.isPending}
                onSubmit={(payload) => submitResultMutation.mutate(payload)}
              />
            )}

            {isDisputed && isParticipant && (
              <AppCard style={{ backgroundColor: 'rgba(255,237,213,0.35)' }}>
                <Text style={{ fontWeight: '700', color: '#9A3412', marginBottom: 8 }}>
                  Partido sin acuerdo
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 19, marginBottom: 12 }}>
                  No hubo consenso sobre el marcador en 48 horas. No se sumaron puntos. Podés dejar una reseña
                  opcional a cada rival por no coincidir en el resultado.
                </Text>
                {match.rivalReviewDeadlineAt && canSubmitRivalReviews && (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 12 }}>
                    Reseñas disponibles hasta el{' '}
                    {new Date(match.rivalReviewDeadlineAt).toLocaleString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
                {canSubmitRivalReviews && rivalPlayers.length > 0 && (
                  <>
                    <PlayerRatingSection
                      players={rivalPlayers}
                      currentUserId={undefined}
                      ratings={rivalRatings}
                      onChange={(userId, score) =>
                        setRivalRatings((prev) => {
                          const next = { ...prev };
                          if (score == null) delete next[userId];
                          else next[userId] = score;
                          return next;
                        })
                      }
                      title="Reseña a rivales (opcional)"
                      subtitle="Del 1 al 5 · por no coincidir en el resultado"
                    />
                    <PrimaryButton
                      label="Guardar reseñas"
                      onPress={() => rivalReviewsMutation.mutate()}
                      loading={rivalReviewsMutation.isPending}
                      fullWidth
                      size="md"
                      style={{ marginTop: 12 }}
                    />
                  </>
                )}
                {!canSubmitRivalReviews && (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
                    El plazo para dejar reseñas a rivales ya venció.
                  </Text>
                )}
              </AppCard>
            )}
          </ScrollView>

          {hasFooterActions && (
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: ui.spacing.lg,
                backgroundColor: ui.colors.bg,
                borderTopWidth: 1,
                borderTopColor: ui.colors.surfaceAlt,
              }}
            >
              {canJoin && (
                <PrimaryButton
                  label={joinRequiresApproval ? 'Solicitar unirme' : 'Unirme al partido'}
                  onPress={() => joinMutation.mutate()}
                  loading={joinMutation.isPending}
                  fullWidth
                  size="lg"
                />
              )}
              {hasPendingJoinRequest && (
                <PrimaryButton
                  label="Cancelar solicitud"
                  onPress={() => cancelJoinRequestMutation.mutate()}
                  loading={cancelJoinRequestMutation.isPending}
                  fullWidth
                  size="lg"
                  variant="outline"
                />
              )}
              {needsDepositPayment && (
                <PrimaryButton
                  label={`Pagar seña${deposit?.amount ? ` (${formatCurrency(deposit.amount, deposit.currency)})` : ''}`}
                  onPress={() => depositCheckoutMutation.mutate()}
                  loading={depositCheckoutMutation.isPending}
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="card" size={20} color="#fff" />}
                  style={{ marginBottom: 8 }}
                />
              )}
              {canConfirmWithoutPay && (
                <PrimaryButton
                  label="Confirmar asistencia"
                  onPress={() => confirmMutation.mutate()}
                  loading={confirmMutation.isPending}
                  fullWidth
                  size="lg"
                  variant={needsDepositPayment ? 'outline' : 'primary'}
                  style={{
                    marginBottom:
                      canConfirmResult || canRejectResult || canLeaveMatch || canCancelMatch ? 8 : 0,
                  }}
                />
              )}
              {(canConfirmResult || canRejectResult) && !isDisputed && (
                <View style={{ marginBottom: 8 }}>
                  {canConfirmResult && (
                    <AppCard style={{ marginBottom: 10 }} padding="sm">
                      <PlayerRatingSection
                        players={orderedPlayers.map((p) => ({ id: p.id, name: p.name, photo: p.photo }))}
                        currentUserId={user?.id}
                        ratings={confirmRatings}
                        onChange={(userId, score) =>
                          setConfirmRatings((prev) => {
                            const next = { ...prev };
                            if (score == null) delete next[userId];
                            else next[userId] = score;
                            return next;
                          })
                        }
                      />
                    </AppCard>
                  )}
                  {canConfirmResult && (
                    <PrimaryButton
                      label="Confirmar resultado"
                      onPress={() => confirmResultMutation.mutate()}
                      loading={confirmResultMutation.isPending}
                      fullWidth
                      size="lg"
                      icon={<Ionicons name="checkmark-done" size={20} color="#fff" />}
                      style={{ marginBottom: 8 }}
                    />
                  )}
                  {canRejectResult && (
                    <PrimaryButton
                      label="No coincido con este marcador"
                      onPress={() => rejectResultMutation.mutate()}
                      loading={rejectResultMutation.isPending}
                      fullWidth
                      size="lg"
                      variant="outline"
                      style={{ marginBottom: 8 }}
                    />
                  )}
                </View>
              )}
              {canLeaveMatch && (
                <PrimaryButton
                  label="Salir del partido"
                  onPress={() => {
                    const organizerAlone = isOrganizer && otherPlayersCount === 0;
                    const organizerTransfer = isOrganizer && otherPlayersCount > 0;
                    const depositHint = depositCancelHint(match.createdAt, hasPaidDeposit);
                    const body = organizerAlone
                      ? `Sos el único jugador: al salir se cancela el partido. ${depositHint}`
                      : organizerTransfer
                        ? `Al salir, la organización pasa al siguiente jugador. ${depositHint}`
                        : depositHint;
                    Alert.alert('Salir del partido', body, [
                      { text: 'Volver', style: 'cancel' },
                      {
                        text: organizerAlone ? 'Salir y cancelar' : 'Salir',
                        style: 'destructive',
                        onPress: () => leaveMatchMutation.mutate(),
                      },
                    ]);
                  }}
                  loading={leaveMatchMutation.isPending}
                  fullWidth
                  size="lg"
                  variant="outline"
                  style={{ marginBottom: canCancelMatch ? 8 : 0 }}
                />
              )}
              {canCancelMatch && (
                <PrimaryButton
                  label="Cancelar partido"
                  onPress={() => {
                    const anyonePaid = depositPlayers.some((p) => p.status === 'APPROVED');
                    Alert.alert(
                      'Cancelar partido',
                      `Se cancelará el partido para todos. ${depositCancelHint(
                        match.createdAt,
                        hasPaidDeposit || anyonePaid,
                      )}`,
                      [
                        { text: 'Volver', style: 'cancel' },
                        {
                          text: 'Cancelar partido',
                          style: 'destructive',
                          onPress: () => cancelMatchMutation.mutate(),
                        },
                      ],
                    );
                  }}
                  loading={cancelMatchMutation.isPending}
                  fullWidth
                  size="lg"
                  variant="outline"
                />
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
