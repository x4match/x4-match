import { View, Text, ScrollView, Alert, TextInput, Share, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { canOrganizeEvents } from '@/lib/roles';
import { api } from '@/lib/api';
import {
  fetchTournamentDetail,
  fetchRegistrations,
  fetchMatches,
  updateTournament,
  deleteTournament,
  addDate,
  removeDate,
  approveRegistration,
  rejectRegistration,
  removeRegistration,
  promoteRegistration,
  registerTeam,
  markRegistrationPaid,
  generateFixture,
  clearFixture,
  setMatchScore,
  clearMatchScore,
  updateMatch,
  formatScore,
  fetchTournamentInvites,
  inviteTournamentPlayers,
  revokeTournamentInvite,
  buildTournamentInviteLink,
  deleteTournamentPhoto,
  fetchTournamentRefunds,
  markTournamentRefundDone,
  updateRegistrationWindow,
  closeTournament,
} from '@/lib/tournament/api';
import {
  FIXED_CATEGORY_OPTIONS,
  getTournamentCategoryMode,
  parseSumCategoryCap,
  teamFitsSumCap,
  teamSumOrdinal,
  clubValidationLabel,
  isTournamentClosed,
  registrationCountdown,
  tournamentMatchLabel,
  WITHDRAW_REFUND_NOTICE_HOURS,
  type FixtureMode,
  type TournamentRegistration,
} from '@/lib/tournament/types';
import {
  FIXTURE_HAS_RESULTS,
  FIXTURE_MODE_LABELS,
  bothTeamsDefined,
  hasBracketPhases,
  isByeMatch,
  slotName,
} from '@/lib/tournament/brackets';
import { TournamentBracketView } from '@/components/tournament/TournamentBracketView';
import {
  getTournamentFlyer,
  pickTournamentFlyer,
  showFlyerPickerOptions,
  uploadTournamentFlyer,
} from '@/lib/tournament/flyer';
import { formatShortDate, formatTime, formatCurrency } from '@/lib/format';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  SectionHeader,
  PrimaryButton,
  InputField,
  OptionChips,
  DateTimeField,
  EmptyState,
  StatusPill,
  Avatar,
  TournamentFlyerField,
} from '@/components/x4match';
import { InternalPairingBoard } from '@/components/tournament/InternalPairingBoard';
import { NewInternalMatchCard } from '@/components/tournament/NewInternalMatchCard';

type Tab = 'general' | 'dates' | 'teams' | 'matches';

function paymentLabel(r: TournamentRegistration): { text: string; color: string } | null {
  if (!r.payment_required) return null;
  const amount =
    r.payment_amount != null ? ` · ${formatCurrency(Number(r.payment_amount))}` : '';
  if (r.payment_status === 'APPROVED') {
    return { text: `Pago acreditado${amount}`, color: ui.colors.success };
  }
  return { text: `Pago pendiente${amount}`, color: ui.colors.warning };
}

/** El formato elegido al crear el torneo va primero. */
function fixtureModesFor(format?: string | null): FixtureMode[] {
  const all: FixtureMode[] = ['GROUPS_THEN_ELIMINATION', 'SINGLE_ELIMINATION', 'ROUND_ROBIN', 'OPEN_COURT'];
  const preferred = all.find((m) => m === format) ?? 'GROUPS_THEN_ELIMINATION';
  return [preferred, ...all.filter((m) => m !== preferred)];
}

type MatchResultInput =
  | { sets: { teamA: number; teamB: number }[] }
  | { walkoverWinner: 'A' | 'B' };

function ScoreInput({
  onSubmit,
  loading,
  teamAName,
  teamBName,
}: {
  onSubmit: (result: MatchResultInput) => void;
  loading?: boolean;
  teamAName?: string;
  teamBName?: string;
}) {
  const [a1, setA1] = useState('');
  const [b1, setB1] = useState('');
  const [a2, setA2] = useState('');
  const [b2, setB2] = useState('');
  const [a3, setA3] = useState('');
  const [b3, setB3] = useState('');
  const cell = {
    borderWidth: 1,
    borderColor: ui.colors.border,
    borderRadius: ui.radius.sm,
    padding: 8,
    width: 48,
    textAlign: 'center' as const,
    color: ui.colors.textPrimary,
    backgroundColor: ui.colors.card,
  };
  const setRow = (
    label: string,
    a: string,
    setA: (v: string) => void,
    b: string,
    setB: (v: string) => void,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Text style={{ fontSize: 13, color: ui.colors.textSecondary, width: 48, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={a}
        onChangeText={setA}
        keyboardType="number-pad"
        style={cell}
        placeholder="0"
        placeholderTextColor={ui.colors.textMuted}
      />
      <Text style={{ color: ui.colors.textMuted, fontWeight: '600' }}>-</Text>
      <TextInput
        value={b}
        onChangeText={setB}
        keyboardType="number-pad"
        style={cell}
        placeholder="0"
        placeholderTextColor={ui.colors.textMuted}
      />
    </View>
  );
  return (
    <View style={{ marginTop: 10 }}>
      {setRow('Set 1', a1, setA1, b1, setB1)}
      {setRow('Set 2', a2, setA2, b2, setB2)}
      {setRow('Set 3', a3, setA3, b3, setB3)}

      <PrimaryButton
        label="Guardar resultado"
        size="sm"
        loading={loading}
        onPress={() => {
          const sets = [
            { teamA: Number(a1) || 0, teamB: Number(b1) || 0 },
            { teamA: Number(a2) || 0, teamB: Number(b2) || 0 },
            { teamA: Number(a3) || 0, teamB: Number(b3) || 0 },
          ].filter((s) => s.teamA || s.teamB);
          onSubmit({ sets });
        }}
      />
      <PrimaryButton
        label="Ganó por W.O."
        size="sm"
        variant="ghost"
        disabled={loading}
        onPress={() =>
          Alert.alert('Partido por W.O.', '¿Qué pareja gana sin jugar?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: teamAName || 'Pareja A', onPress: () => onSubmit({ walkoverWinner: 'A' }) },
            { text: teamBName || 'Pareja B', onPress: () => onSubmit({ walkoverWinner: 'B' }) },
          ])
        }
        style={{ marginTop: 6 }}
      />
    </View>
  );
}

export default function TournamentManageScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const initialTab: Tab =
    tabParam === 'dates' || tabParam === 'teams' || tabParam === 'matches' || tabParam === 'general'
      ? tabParam
      : 'general';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dateValue, setDateValue] = useState<Date | null>(null);
  const [timeValue, setTimeValue] = useState<Date | null>(null);
  const [dateLabel, setDateLabel] = useState('');
  const [closesDate, setClosesDate] = useState<Date | null>(null);
  const [closesTime, setClosesTime] = useState<Date | null>(null);

  // Inscribir pareja (el organizador inscribe en nombre de los jugadores)
  const [regPlayer1, setRegPlayer1] = useState('');
  const [regPlayer2, setRegPlayer2] = useState('');
  const [regEmail1, setRegEmail1] = useState('');
  const [regEmail2, setRegEmail2] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPlayer1Category, setRegPlayer1Category] = useState('');
  const [regPlayer2Category, setRegPlayer2Category] = useState('');
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<
    { userId: string; name: string; photo?: string }[]
  >([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const newMatchY = useRef(0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tournament-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-registrations', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-matches', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-standings', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-groups', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-invites', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-players', id] });
  };

  const { data: tournament } = useQuery({
    queryKey: ['tournament-detail', id],
    queryFn: () => fetchTournamentDetail(id!),
    enabled: !!id,
  });

  const canManage =
    !!user?.id &&
    (tournament?.viewer_can_manage ||
      (canOrganizeEvents(user.role) &&
        (!tournament ||
          tournament.organizer_user_id === user.id ||
          user.role === 'SUPER_ADMIN' ||
          user.role === 'CLUB_ADMIN')));
  const isOwnerOrganizer = !!user?.id && tournament?.organizer_user_id === user.id;

  const { data: registrations } = useQuery({
    queryKey: ['tournament-registrations', id],
    queryFn: () => fetchRegistrations(id!),
    enabled: !!id,
  });

  const { data: matches } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => fetchMatches(id!),
    enabled: !!id,
  });

  const isInternal = tournament?.modality === 'INTERNAL';
  const isExternal = tournament?.modality === 'EXTERNAL';

  const { data: invites } = useQuery({
    queryKey: ['tournament-invites', id],
    queryFn: () => fetchTournamentInvites(id!),
    enabled: !!id && isInternal && canManage,
  });

  const { data: refunds } = useQuery({
    queryKey: ['tournament-refunds', id],
    queryFn: () => fetchTournamentRefunds(id!),
    enabled: !!id && canManage && Number(tournament?.price) > 0,
  });

  const refundPolicyMutation = useMutation({
    mutationFn: (refundOnWithdraw: boolean) => updateTournament(id!, { refundOnWithdraw }),
    onSuccess: invalidate,
    onError: (e: any) =>
      Alert.alert('Error', e.response?.data?.message || 'No se pudo actualizar la política'),
  });

  const markRefundMutation = useMutation({
    mutationFn: (refundId: string) => markTournamentRefundDone(id!, refundId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament-refunds', id] }),
    onError: (e: any) =>
      Alert.alert('Error', e.response?.data?.message || 'No se pudo marcar la devolución'),
  });

  const inviteMutation = useMutation({
    mutationFn: (userIds: string[]) => inviteTournamentPlayers(id!, userIds),
    onSuccess: () => {
      setInviteQuery('');
      setInviteResults([]);
      invalidate();
      Alert.alert('Invitación enviada', 'El jugador ya puede acceder al torneo.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo invitar'),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => revokeTournamentInvite(id!, inviteId),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo revocar'),
  });

  const searchInvitePlayers = async (q: string) => {
    setInviteQuery(q);
    if (q.trim().length < 2) {
      setInviteResults([]);
      return;
    }
    setInviteSearchLoading(true);
    try {
      const res = await api.get('/players/search', { params: { q: q.trim() } });
      const invitedIds = new Set((invites || []).map((i) => i.invited_user_id).filter(Boolean));
      setInviteResults(
        (res.data || [])
          .map((row: any) => ({
            userId: String(row.userId),
            name: String(row.name || row.nickname || 'Jugador'),
            photo: row.photo ? String(row.photo) : undefined,
          }))
          .filter((p: { userId: string }) => p.userId !== user?.id && !invitedIds.has(p.userId)),
      );
    } catch {
      setInviteResults([]);
    } finally {
      setInviteSearchLoading(false);
    }
  };

  const shareInviteLink = async () => {
    const token = tournament?.invite_token;
    if (!id || !token) {
      Alert.alert('Sin link', 'Este torneo no tiene link de invitación.');
      return;
    }
    const link = buildTournamentInviteLink(id, token);
    await Share.share({
      message: `Te invito al torneo "${tournament.name}" en x4 match.\n${link}`,
      title: tournament.name,
    });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateTournament(id!, { status }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo actualizar'),
  });

  const windowMutation = useMutation({
    mutationFn: (payload: { closesAt?: string | null; action?: 'CLOSE' | 'REOPEN' }) =>
      updateRegistrationWindow(id!, payload),
    onSuccess: () => {
      setClosesDate(null);
      setClosesTime(null);
      invalidate();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo actualizar la inscripción'),
  });

  const closeTournamentMutation = useMutation({
    mutationFn: (force: boolean) => closeTournament(id!, force),
    onSuccess: () => {
      invalidate();
      Alert.alert('Torneo cerrado', 'Se repartieron los puntos y ya no se pueden cambiar resultados.');
    },
    onError: (e: any, force) => {
      const data = e.response?.data;
      if (data?.code === 'PENDING_MATCHES' && !force) {
        Alert.alert('Quedan partidos sin jugar', data.message, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar igual', style: 'destructive', onPress: () => closeTournamentMutation.mutate(true) },
        ]);
        return;
      }
      Alert.alert('Error', data?.message || 'No se pudo cerrar el torneo');
    },
  });

  const saveClosesAt = () => {
    if (!closesDate) {
      Alert.alert('Falta la fecha', 'Elegí hasta qué día se pueden inscribir.');
      return;
    }
    const at = new Date(closesDate);
    if (closesTime) at.setHours(closesTime.getHours(), closesTime.getMinutes(), 0, 0);
    else at.setHours(23, 59, 0, 0);
    windowMutation.mutate({ closesAt: at.toISOString() });
  };

  const flyerMutation = useMutation({
    mutationFn: async (
      action: { type: 'upload'; flyer: Awaited<ReturnType<typeof pickTournamentFlyer>> } | {
        type: 'remove';
        photoId: string;
      },
    ) => {
      if (action.type === 'remove') {
        await deleteTournamentPhoto(id!, action.photoId);
        return;
      }
      if (!action.flyer) {
        throw new Error('No se seleccionó ninguna imagen');
      }
      const current = getTournamentFlyer(tournament?.photos);
      await uploadTournamentFlyer(id!, action.flyer, current?.id);
    },
    onSuccess: invalidate,
    onError: (e: any) =>
      Alert.alert(
        'Error',
        e?.response?.data?.message || e?.message || 'No se pudo actualizar el flyer',
      ),
  });

  const addDateMutation = useMutation({
    mutationFn: () => {
      const playDate = new Date(dateValue!);
      if (timeValue) {
        playDate.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
      } else {
        playDate.setHours(0, 0, 0, 0);
      }
      return addDate(id!, { playDate: playDate.toISOString(), label: dateLabel.trim() || undefined });
    },
    onSuccess: () => {
      setDateValue(null);
      setTimeValue(null);
      setDateLabel('');
      invalidate();
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Fecha inválida'),
  });

  const registerTeamMutation = useMutation({
    mutationFn: () => {
      const isSum = getTournamentCategoryMode(tournament?.category) === 'SUM';
      // Categoría fija = la del torneo. En suma se registra el detalle de cada jugador.
      const category = isSum
        ? `${regPlayer1Category} + ${regPlayer2Category}`
        : tournament?.category || undefined;
      return registerTeam(id!, {
        player1Name: regPlayer1.trim(),
        player2Name: regPlayer2.trim(),
        player1Email: regEmail1.trim() || undefined,
        player2Email: regEmail2.trim() || undefined,
        phone: regPhone.trim() || undefined,
        category,
        onBehalf: true,
      });
    },
    onSuccess: () => {
      setRegPlayer1('');
      setRegPlayer2('');
      setRegEmail1('');
      setRegEmail2('');
      setRegPhone('');
      setRegPlayer1Category('');
      setRegPlayer2Category('');
      invalidate();
      Alert.alert('Pareja inscripta', 'Quedó en la lista de inscriptos.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo inscribir la pareja'),
  });

  const removeDateMutation = useMutation({
    mutationFn: (dateId: string) => removeDate(id!, dateId),
    onSuccess: invalidate,
  });

  const approveMutation = useMutation({
    mutationFn: (regId: string) => approveRegistration(id!, regId),
    onSuccess: invalidate,
  });
  const rejectMutation = useMutation({
    mutationFn: (regId: string) => rejectRegistration(id!, regId),
    onSuccess: invalidate,
  });
  const promoteMutation = useMutation({
    mutationFn: (regId: string) => promoteRegistration(id!, regId),
    onSuccess: () => {
      invalidate();
      Alert.alert('Promovida', 'La pareja pasó de lista de espera a aprobada.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo promover'),
  });
  const removeRegMutation = useMutation({
    mutationFn: (regId: string) => removeRegistration(id!, regId),
    onSuccess: invalidate,
  });
  const markPaidMutation = useMutation({
    mutationFn: (regId: string) => markRegistrationPaid(id!, regId),
    onSuccess: () => {
      invalidate();
      Alert.alert('Pago acreditado', 'La inscripción quedó marcada como pagada.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo marcar el pago'),
  });

  const fixtureMutation = useMutation({
    mutationFn: ({ mode, force }: { mode: FixtureMode; force?: boolean }) =>
      generateFixture(id!, { mode, reset: true, force }),
    onSuccess: () => {
      Alert.alert('Fixture generado', 'Se crearon los partidos y el torneo pasó a "En juego".');
      invalidate();
      setTab('matches');
    },
    onError: (e: any, vars) => {
      const data = e.response?.data;
      if (data?.code === FIXTURE_HAS_RESULTS && !vars.force) {
        Alert.alert('Hay resultados cargados', data.message, [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Regenerar igual',
            style: 'destructive',
            onPress: () => fixtureMutation.mutate({ mode: vars.mode, force: true }),
          },
        ]);
        return;
      }
      Alert.alert('Error', data?.message || 'No se pudo generar');
    },
  });

  const generateWithMode = (mode: FixtureMode) => {
    if (!matches?.length) {
      fixtureMutation.mutate({ mode });
      return;
    }
    Alert.alert(
      'Regenerar fixture',
      `Se borran los partidos actuales y se arma de nuevo como "${FIXTURE_MODE_LABELS[mode]}".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Regenerar', style: 'destructive', onPress: () => fixtureMutation.mutate({ mode }) },
      ],
    );
  };

  const clearFixtureMutation = useMutation({
    mutationFn: () => clearFixture(id!),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo borrar el fixture'),
  });

  const clearScoreMutation = useMutation({
    mutationFn: (matchId: string) => clearMatchScore(id!, matchId),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('No se puede corregir', e.response?.data?.message || 'No se pudo borrar el resultado'),
  });

  const scoreMutation = useMutation({
    mutationFn: ({ matchId, result }: { matchId: string; result: MatchResultInput }) =>
      setMatchScore(id!, matchId, result),
    onSuccess: () => {
      invalidate();
      if (!isInternal) return;
      Alert.alert('Resultado cargado', '¿Querés abrir otro partido?', [
        { text: 'Listo', style: 'cancel' },
        {
          text: 'Abrir otro partido',
          onPress: () => scrollRef.current?.scrollTo({ y: newMatchY.current, animated: true }),
        },
      ]);
    },
    onError: (e: any) => Alert.alert('No se pudo cargar', e.response?.data?.message || 'Revisá el resultado'),
  });

  const courtMutation = useMutation({
    mutationFn: ({ matchId, courtLabel }: { matchId: string; courtLabel: string }) =>
      updateMatch(id!, matchId, { courtLabel, status: 'IN_PROGRESS' }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTournament(id!),
    onSuccess: () => {
      Alert.alert('Torneo eliminado', '');
      router.replace('/(tabs)/organizer' as any);
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo eliminar'),
  });

  if (!canManage) {
    return (
      <Screen>
        <StackHeader title="Gestión" />
        <EmptyState
          icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Solo organizadores pueden gestionar el torneo."
        />
      </Screen>
    );
  }

  if (isTournamentClosed(tournament) && user?.role !== 'SUPER_ADMIN') {
    return (
      <Screen>
        <StackHeader title="Gestión" />
        <EmptyState
          icon={<Ionicons name="flag-outline" size={32} color={ui.colors.textMuted} />}
          title="Torneo terminado"
          description="Pasaron más de 48 horas desde el último día del torneo y ya no se puede gestionar. Podés ver inscriptos, partidos y posiciones en el detalle."
          action={
            <PrimaryButton
              label="Ver torneo"
              onPress={() => router.replace(`/tournament/${id}` as any)}
            />
          }
        />
      </Screen>
    );
  }

  const pending = (registrations || []).filter((r) => r.status === 'PENDING');
  const waitlist = (registrations || []).filter((r) => r.status === 'WAITLIST');
  const approved = (registrations || []).filter((r) => r.status === 'APPROVED');
  const flyer = getTournamentFlyer(tournament?.photos);
  const isSingleDay = (tournament?.schedule_type || 'SINGLE_DAY') !== 'MULTI_DAY';

  return (
    <Screen>
      <StackHeader title="Gestionar torneo" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {(
            [
              { key: 'general' as const, label: 'General' },
              { key: 'dates' as const, label: isSingleDay ? 'Día' : 'Fechas' },
              {
                key: 'teams' as const,
                label: isInternal
                  ? 'Parejas'
                  : `Inscriptos${pending.length || waitlist.length ? ` (${pending.length + waitlist.length})` : ''}`,
              },
              { key: 'matches' as const, label: 'Partidos' },
            ] as const
          ).map(({ key, label }) => (
            <PrimaryButton
              key={key}
              label={label}
              size="sm"
              variant={tab === key ? 'primary' : 'ghost'}
              onPress={() => setTab(key)}
              style={tab !== key ? { backgroundColor: ui.colors.surface } : undefined}
            />
          ))}
        </View>

        {tab === 'general' && tournament && (
          <>
            <AppCard>
              <Text style={{ fontWeight: '800', fontSize: 18, color: ui.colors.textPrimary }}>{tournament.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: ui.colors.textSecondary }}>Estado:</Text>
                <StatusPill status={tournament.status} />
                {tournament.modality ? <StatusPill status={tournament.modality} /> : null}
              </View>
              {isInternal ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: ui.colors.textSecondary }}>
                  Torneo interno: cargás los jugadores en drive o revés, armás las parejas y generás el
                  fixture. Sin premios ni inscripción paga.
                </Text>
              ) : null}
              <PrimaryButton
                label="Ver como jugador"
                variant="outline"
                fullWidth
                style={{ marginTop: 14 }}
                onPress={() => router.push(`/tournament/${id}?preview=1` as any)}
              />
              <Text style={{ marginTop: 8, fontSize: 12, color: ui.colors.textMuted, textAlign: 'center' }}>
                Así se ve la ficha para los jugadores (flyer, info, cupos e inscripción).
              </Text>
            </AppCard>

            {Number(tournament.price) > 0 ? (
              <>
                <SectionHeader title="Cobro de inscripción" dark />
                <AppCard>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {formatCurrency(Number(tournament.price))} por jugador
                  </Text>
                  <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                    {tournament.accept_transfer && tournament.accept_mercadopago
                      ? 'Transferencia y Mercado Pago'
                      : tournament.accept_transfer
                        ? 'Solo transferencia'
                        : tournament.accept_mercadopago
                          ? 'Solo Mercado Pago'
                          : 'Mercado Pago (por defecto)'}
                  </Text>
                  {tournament.accept_transfer ? (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      {tournament.transfer_alias ? (
                        <Text style={{ color: ui.colors.textPrimary }}>Alias: {tournament.transfer_alias}</Text>
                      ) : null}
                      {tournament.transfer_cbu ? (
                        <Text style={{ color: ui.colors.textPrimary }}>CBU/CVU: {tournament.transfer_cbu}</Text>
                      ) : null}
                      {tournament.transfer_holder_name ? (
                        <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                          Titular: {tournament.transfer_holder_name}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginTop: 16 }}>
                    Devolución si se bajan
                  </Text>
                  <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Si la pareja se baja hasta {WITHDRAW_REFUND_NOTICE_HOURS} h antes del torneo, se le devuelve
                    la inscripción. Mercado Pago se reembolsa solo; las transferencias las devolvés vos.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <PrimaryButton
                      label="Devolver"
                      size="sm"
                      variant={tournament.refund_on_withdraw !== false ? 'primary' : 'ghost'}
                      disabled={refundPolicyMutation.isPending}
                      onPress={() => refundPolicyMutation.mutate(true)}
                    />
                    <PrimaryButton
                      label="No devolver"
                      size="sm"
                      variant={tournament.refund_on_withdraw === false ? 'primary' : 'ghost'}
                      disabled={refundPolicyMutation.isPending}
                      onPress={() => refundPolicyMutation.mutate(false)}
                    />
                  </View>
                </AppCard>

                {refunds?.length ? (
                  <>
                    <SectionHeader
                      title="Devoluciones"
                      subtitle={`${refunds.filter((r) => r.status === 'PENDING').length} pendientes`}
                      dark
                    />
                    {refunds.map((refund) => (
                      <AppCard key={refund.id} style={{ marginBottom: 10 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                          {refund.player1_name} / {refund.player2_name}
                        </Text>
                        <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                          {formatCurrency(Number(refund.amount))} · se bajó el {formatShortDate(refund.created_at)}
                          {refund.phone ? ` · Tel. ${refund.phone}` : ''}
                        </Text>
                        {refund.status === 'PENDING' ? (
                          <PrimaryButton
                            label="Marcar como devuelto"
                            size="sm"
                            variant="outline"
                            style={{ marginTop: 10, alignSelf: 'flex-start' }}
                            loading={markRefundMutation.isPending && markRefundMutation.variables === refund.id}
                            onPress={() => markRefundMutation.mutate(refund.id)}
                          />
                        ) : (
                          <Text style={{ color: ui.colors.success, fontSize: 13, marginTop: 6, fontWeight: '600' }}>
                            Devuelto
                          </Text>
                        )}
                      </AppCard>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}

            {isExternal && tournament.club_validation_status === 'PENDING' ? (
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                  Esperando que un admin de {tournament.club_name || 'el club'} valide el torneo. Hasta entonces no
                  aparece en el listado público.
                </Text>
              </AppCard>
            ) : null}

            <SectionHeader title="Flyer" subtitle="Opcional · diseño de los organizadores" dark />
            <AppCard>
              <TournamentFlyerField
                previewUri={flyer?.photo_url}
                loading={flyerMutation.isPending}
                onPress={() =>
                  showFlyerPickerOptions({
                    hasFlyer: !!flyer,
                    onPick: async (source) => {
                      const picked = await pickTournamentFlyer(source);
                      if (picked) flyerMutation.mutate({ type: 'upload', flyer: picked });
                    },
                    onRemove: flyer
                      ? () => flyerMutation.mutate({ type: 'remove', photoId: flyer.id })
                      : undefined,
                  })
                }
                onClear={
                  flyer
                    ? () => flyerMutation.mutate({ type: 'remove', photoId: flyer.id })
                    : undefined
                }
              />
            </AppCard>

            {isInternal ? (
              <>
                <SectionHeader
                  title="Invitados"
                  subtitle={`${(invites || []).length} invitados`}
                  dark
                />
                <AppCard>
                  <PrimaryButton
                    label="Compartir link de invitación"
                    fullWidth
                    variant="outline"
                    onPress={shareInviteLink}
                    icon={<Ionicons name="share-outline" size={18} color={ui.colors.primary} />}
                    style={{ marginBottom: 12 }}
                  />
                  <InputField
                    label="Invitar jugador de la app"
                    value={inviteQuery}
                    onChangeText={searchInvitePlayers}
                    placeholder="Buscar por nombre o nickname"
                  />
                  {inviteSearchLoading ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>Buscando…</Text>
                  ) : null}
                  {inviteResults.map((player) => (
                    <TouchableOpacity
                      key={player.userId}
                      onPress={() => inviteMutation.mutate([player.userId])}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: ui.colors.border,
                      }}
                    >
                      <Avatar name={player.name} photo={player.photo} size="sm" />
                      <Text style={{ flex: 1, color: ui.colors.textPrimary, fontWeight: '600' }}>
                        {player.name}
                      </Text>
                      <Ionicons name="person-add-outline" size={18} color={ui.colors.primary} />
                    </TouchableOpacity>
                  ))}
                  {(invites || []).map((invite) => (
                    <View
                      key={invite.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: ui.colors.border,
                      }}
                    >
                      <Avatar
                        name={invite.invited_user_name || 'Jugador'}
                        photo={invite.invited_user_photo}
                        size="sm"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: ui.colors.textPrimary, fontWeight: '600' }}>
                          {invite.invited_user_name || invite.invited_user_nickname || 'Jugador'}
                        </Text>
                        <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>{invite.status}</Text>
                      </View>
                      <PrimaryButton
                        label="Quitar"
                        size="sm"
                        variant="ghost"
                        onPress={() => revokeInviteMutation.mutate(invite.id)}
                      />
                    </View>
                  ))}
                </AppCard>
              </>
            ) : null}

            {!isInternal ? (
              <>
                <SectionHeader title="Inscripciones" dark />
                <AppCard>
                  {tournament.status === 'OPEN_REGISTRATION' ? (
                    <PrimaryButton
                      label="Cerrar inscripciones"
                      variant="outline"
                      fullWidth
                      loading={statusMutation.isPending}
                      onPress={() => statusMutation.mutate('IN_PROGRESS')}
                    />
                  ) : tournament.status === 'DRAFT' ? (
                    <PrimaryButton
                      label={
                        isExternal && tournament.club_validation_status === 'PENDING'
                          ? 'Pendiente de validación del club'
                          : 'Abrir inscripciones'
                      }
                      fullWidth
                      disabled={isExternal && tournament.club_validation_status === 'PENDING'}
                      loading={statusMutation.isPending}
                      onPress={() => statusMutation.mutate('OPEN_REGISTRATION')}
                    />
                  ) : (
                    <PrimaryButton
                      label="Reabrir inscripciones"
                      variant="outline"
                      fullWidth
                      loading={statusMutation.isPending}
                      onPress={() => statusMutation.mutate('OPEN_REGISTRATION')}
                    />
                  )}
                </AppCard>

                <SectionHeader
                  title="Cierre de inscripción"
                  subtitle={registrationCountdown(tournament)?.label ?? 'Sin fecha de cierre'}
                  dark
                />
                <AppCard>
                  {tournament.registration_closed_at ? (
                    <>
                      <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                        Cerraste la inscripción definitivamente: nadie más se puede anotar (vos sí podés inscribir
                        parejas a mano).
                      </Text>
                      <PrimaryButton
                        label="Reabrir inscripción"
                        variant="outline"
                        fullWidth
                        loading={windowMutation.isPending}
                        onPress={() => windowMutation.mutate({ action: 'REOPEN' })}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                        {tournament.registration_closes_at
                          ? `Cierra el ${formatShortDate(tournament.registration_closes_at)} a las ${formatTime(tournament.registration_closes_at)}. Los jugadores ven la cuenta regresiva.`
                          : 'Programá hasta cuándo se pueden inscribir. Los jugadores ven la cuenta regresiva.'}
                      </Text>
                      <DateTimeField
                        label="Cierra el día"
                        mode="date"
                        value={closesDate}
                        onChange={setClosesDate}
                        minimumDate={new Date()}
                      />
                      <DateTimeField label="A las (opcional)" mode="time" value={closesTime} onChange={setClosesTime} />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Programar cierre"
                            size="sm"
                            fullWidth
                            disabled={!closesDate}
                            loading={windowMutation.isPending && !windowMutation.variables?.action}
                            onPress={saveClosesAt}
                          />
                        </View>
                        {tournament.registration_closes_at ? (
                          <View style={{ flex: 1 }}>
                            <PrimaryButton
                              label="Quitar fecha"
                              size="sm"
                              variant="ghost"
                              fullWidth
                              onPress={() => windowMutation.mutate({ closesAt: null })}
                            />
                          </View>
                        ) : null}
                      </View>
                      <PrimaryButton
                        label="Cerrar definitivamente"
                        variant="outline"
                        fullWidth
                        style={{ marginTop: 10 }}
                        loading={windowMutation.isPending && windowMutation.variables?.action === 'CLOSE'}
                        onPress={() =>
                          Alert.alert(
                            'Cerrar inscripción',
                            'Nadie más se va a poder inscribir. Después podés armar las zonas.',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Cerrar', style: 'destructive', onPress: () => windowMutation.mutate({ action: 'CLOSE' }) },
                            ],
                          )
                        }
                      />
                    </>
                  )}
                </AppCard>

                <SectionHeader title="Fixture" subtitle={`${approved.length} parejas aprobadas`} dark />
                <AppCard>
                  <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                    Generá los partidos con las parejas aprobadas. En "Zonas + cuadro" se arman zonas de 3
                    (o 4) sembradas por ranking, clasifican los 2 primeros y el cuadro se completa solo al
                    cerrarse cada zona.
                  </Text>
                  <PrimaryButton
                    label="Armar zonas a mano"
                    variant="outline"
                    fullWidth
                    disabled={approved.length < 2}
                    onPress={() => router.push(`/tournament/${id}/zones` as any)}
                    style={{ marginBottom: 8 }}
                  />
                  {fixtureModesFor(tournament?.format).map((mode, index) => (
                    <PrimaryButton
                      key={mode}
                      label={matches?.length ? `Regenerar: ${FIXTURE_MODE_LABELS[mode]}` : FIXTURE_MODE_LABELS[mode]}
                      variant={index === 0 ? 'primary' : 'outline'}
                      fullWidth
                      disabled={approved.length < 2}
                      loading={fixtureMutation.isPending && fixtureMutation.variables?.mode === mode}
                      onPress={() => generateWithMode(mode)}
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                </AppCard>
              </>
            ) : null}

            <SectionHeader title="Estado del torneo" dark />
            <AppCard>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Al cerrar el torneo se reparten los puntos del ranking y queda bloqueado: no se pueden cambiar
                resultados ni inscripciones.
              </Text>
              <PrimaryButton
                label="Cerrar torneo"
                variant="outline"
                fullWidth
                loading={closeTournamentMutation.isPending}
                onPress={() =>
                  Alert.alert('Cerrar torneo', '¿Cerrar el torneo y repartir los puntos? No se puede deshacer.', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Cerrar torneo', style: 'destructive', onPress: () => closeTournamentMutation.mutate(false) },
                  ])
                }
                style={{ marginBottom: 8 }}
              />
              <PrimaryButton
                label="Eliminar torneo"
                variant="ghost"
                fullWidth
                onPress={() =>
                  Alert.alert('Eliminar torneo', '¿Seguro? Se borran inscripciones y partidos.', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
                  ])
                }
                style={{ backgroundColor: 'rgba(220,38,38,0.08)' }}
              />
            </AppCard>
          </>
        )}

        {tab === 'dates' && (
          <>
            <AppCard>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                {isSingleDay
                  ? 'Torneo de un día: una sola fecha y hora. El formato del cuadro (zonas, eliminación, cancha abierta) se elige aparte.'
                  : 'Torneo largo: podés ir agregando jornadas. Un circuito es otra cosa (etapas y sedes).'}
              </Text>
            </AppCard>

            {isSingleDay && (tournament?.dates?.length ?? 0) >= 1 ? null : (
              <>
                <SectionHeader
                  title={
                    isSingleDay
                      ? 'Día y hora'
                      : tournament?.dates?.length
                        ? 'Agregar jornada'
                        : 'Primera jornada'
                  }
                  subtitle={isSingleDay ? 'Cuándo se juega' : 'Fecha y hora de la jornada'}
                  dark
                />
                <AppCard>
                  <DateTimeField
                    label="Fecha"
                    mode="date"
                    value={dateValue}
                    onChange={setDateValue}
                    minimumDate={new Date()}
                  />
                  <DateTimeField label="Hora" mode="time" value={timeValue} onChange={setTimeValue} />
                  {!isSingleDay ? (
                    <InputField
                      label="Etiqueta (opcional)"
                      value={dateLabel}
                      onChangeText={setDateLabel}
                      placeholder="Ej. Fase de grupos · Semifinales"
                    />
                  ) : null}
                  <PrimaryButton
                    label={
                      isSingleDay
                        ? 'Guardar día del torneo'
                        : tournament?.dates?.length
                          ? 'Agregar jornada'
                          : 'Guardar primera jornada'
                    }
                    fullWidth
                    loading={addDateMutation.isPending}
                    onPress={() => {
                      if (!dateValue) {
                        Alert.alert('Falta la fecha', 'Seleccioná la fecha.');
                        return;
                      }
                      if (isSingleDay && !timeValue) {
                        Alert.alert('Falta la hora', 'Un torneo de un día necesita hora de inicio.');
                        return;
                      }
                      addDateMutation.mutate();
                    }}
                  />
                </AppCard>
              </>
            )}

            {isSingleDay && (tournament?.dates?.length ?? 0) >= 1 ? (
              <AppCard>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                  Ya hay un día cargado. Si necesitás cambiarlo, quitá el actual y cargá uno nuevo.
                </Text>
              </AppCard>
            ) : null}

            <SectionHeader
              title={
                isSingleDay
                  ? 'Día del torneo'
                  : tournament?.dates?.length === 1
                    ? 'Jornada cargada'
                    : 'Jornadas cargadas'
              }
              dark
            />
            {!tournament?.dates?.length ? (
              <AppCard>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                  {isSingleDay
                    ? 'Todavía no hay día cargado.'
                    : 'Todavía no hay jornadas. Agregá la primera cuando quieras.'}
                </Text>
              </AppCard>
            ) : (
              tournament.dates.map((d) => (
                <AppCard key={d.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                        {formatShortDate(d.play_date)} · {formatTime(d.play_date)}
                      </Text>
                      {d.label ? <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>{d.label}</Text> : null}
                    </View>
                    <PrimaryButton label="Quitar" size="sm" variant="ghost" onPress={() => removeDateMutation.mutate(d.id)} />
                  </View>
                </AppCard>
              ))
            )}
          </>
        )}

        {tab === 'teams' && isInternal && (
          <>
            <InternalPairingBoard tournamentId={id!} onChanged={invalidate} />

            <SectionHeader title="Armar partidos" subtitle={`${approved.length} parejas`} dark />
            <AppCard>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                {matches?.length
                  ? 'Ya hay partidos generados. Podés sumar más desde la pestaña Partidos, o borrar el fixture y volver a armarlo.'
                  : 'Con las parejas formadas se arma el fixture. Elegí cómo se enfrentan.'}
              </Text>
              {(
                [
                  { mode: 'ROUND_ROBIN', label: 'Todos contra todos' },
                  { mode: 'OPEN_COURT', label: 'Por turnos (según canchas)' },
                  { mode: 'SINGLE_ELIMINATION', label: 'Eliminación directa' },
                ] as const
              ).map(({ mode, label }, index) => (
                <PrimaryButton
                  key={mode}
                  label={matches?.length ? `Regenerar: ${label.toLowerCase()}` : label}
                  variant={index === 0 ? 'primary' : 'outline'}
                  fullWidth
                  disabled={approved.length < 2}
                  loading={fixtureMutation.isPending && fixtureMutation.variables?.mode === mode}
                  onPress={() => generateWithMode(mode)}
                  style={{ marginBottom: 8 }}
                />
              ))}
              {matches?.length ? (
                <PrimaryButton
                  label="Borrar fixture"
                  variant="ghost"
                  fullWidth
                  loading={clearFixtureMutation.isPending}
                  onPress={() =>
                    Alert.alert('Borrar fixture', 'Se eliminan todos los partidos y resultados cargados.', [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Borrar',
                        style: 'destructive',
                        onPress: () => clearFixtureMutation.mutate(),
                      },
                    ])
                  }
                  style={{ backgroundColor: ui.colors.dangerSoft }}
                />
              ) : null}
            </AppCard>
          </>
        )}

        {tab === 'teams' && !isInternal && (
          <>
            <SectionHeader title="Inscribir pareja" subtitle="En nombre de los jugadores" dark />
            <AppCard>
              <InputField label="Jugador 1" value={regPlayer1} onChangeText={setRegPlayer1} placeholder="Nombre y apellido" />
              <InputField
                label="Email jugador 1 (opcional)"
                value={regEmail1}
                onChangeText={setRegEmail1}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <InputField label="Jugador 2" value={regPlayer2} onChangeText={setRegPlayer2} placeholder="Nombre y apellido" />
              <InputField
                label="Email jugador 2 (opcional)"
                value={regEmail2}
                onChangeText={setRegEmail2}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <InputField label="Teléfono de contacto (opcional)" value={regPhone} onChangeText={setRegPhone} keyboardType="phone-pad" />
              {getTournamentCategoryMode(tournament?.category) === 'SUM' ? (
                <>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8 }}>
                    Torneo {tournament?.category}: indicá la categoría de cada jugador (la suma debe ser ≤{' '}
                    {parseSumCategoryCap(tournament?.category)}).
                  </Text>
                  <OptionChips
                    label="Categoría jugador 1"
                    options={FIXED_CATEGORY_OPTIONS}
                    selected={regPlayer1Category}
                    onSelect={setRegPlayer1Category}
                    horizontal
                  />
                  <OptionChips
                    label="Categoría jugador 2"
                    options={FIXED_CATEGORY_OPTIONS}
                    selected={regPlayer2Category}
                    onSelect={setRegPlayer2Category}
                    horizontal
                  />
                  {regPlayer1Category && regPlayer2Category ? (
                    <Text
                      style={{
                        fontSize: 12,
                        color: ui.colors.textSecondary,
                        marginBottom: 12,
                      }}
                    >
                      Suma actual:{' '}
                      {teamSumOrdinal(regPlayer1Category, regPlayer2Category) ?? '—'}
                      {parseSumCategoryCap(tournament?.category) != null
                        ? ` / máx. ${parseSumCategoryCap(tournament?.category)}`
                        : ''}
                    </Text>
                  ) : null}
                </>
              ) : (
                <View
                  style={{
                    backgroundColor: ui.colors.surfaceAlt,
                    borderRadius: ui.radius.md,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Categoría del torneo</Text>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginTop: 4 }}>
                    {tournament?.category || 'Sin categoría'}
                  </Text>
                </View>
              )}
              <PrimaryButton
                label="Inscribir pareja"
                fullWidth
                loading={registerTeamMutation.isPending}
                onPress={() => {
                  if (!regPlayer1.trim() || !regPlayer2.trim()) {
                    Alert.alert('Datos incompletos', 'Completá el nombre de ambos jugadores.');
                    return;
                  }
                  const sumCap = parseSumCategoryCap(tournament?.category);
                  if (sumCap != null) {
                    if (!regPlayer1Category || !regPlayer2Category) {
                      Alert.alert('Faltan categorías', 'Indicá la categoría de ambos jugadores.');
                      return;
                    }
                    if (!teamFitsSumCap(regPlayer1Category, regPlayer2Category, sumCap)) {
                      const sum = teamSumOrdinal(regPlayer1Category, regPlayer2Category);
                      Alert.alert(
                        'Pareja fuera de tope',
                        `La suma es ${sum} y el torneo admite hasta ${sumCap}.`,
                      );
                      return;
                    }
                  }
                  registerTeamMutation.mutate();
                }}
              />
            </AppCard>

            <SectionHeader title="Pendientes de aprobación" subtitle={`${pending.length}`} dark />
            {pending.length === 0 ? (
              <AppCard>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>No hay inscripciones pendientes.</Text>
              </AppCard>
            ) : (
              pending.map((r) => {
                const pay = isOwnerOrganizer ? paymentLabel(r) : null;
                const canMarkPaid =
                  isOwnerOrganizer && r.payment_required && r.payment_status !== 'APPROVED';
                return (
                  <AppCard key={r.id}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                      {r.player1_name} / {r.player2_name}
                    </Text>
                    {r.category ? (
                      <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        Cat. {r.category}
                      </Text>
                    ) : null}
                    {r.category_review ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 6,
                          marginTop: 8,
                          padding: 8,
                          borderRadius: ui.radius.md,
                          backgroundColor: ui.colors.warningSoft,
                        }}
                      >
                        <Ionicons name="alert-circle-outline" size={16} color={ui.colors.warning} />
                        <Text style={{ flex: 1, color: ui.colors.textPrimary, fontSize: 12 }}>
                          A validar: {r.category_review}
                        </Text>
                      </View>
                    ) : null}
                    {isOwnerOrganizer ? (
                      pay ? (
                        <Text style={{ color: pay.color, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                          {pay.text}
                        </Text>
                      ) : (
                        <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                          Sin cargo de inscripción
                        </Text>
                      )
                    ) : null}
                    {canMarkPaid ? (
                      <PrimaryButton
                        label="Marcar como pagado"
                        size="sm"
                        variant="outline"
                        fullWidth
                        loading={markPaidMutation.isPending}
                        onPress={() =>
                          Alert.alert(
                            'Confirmar pago',
                            '¿Marcar esta inscripción como pagada? (efectivo, transferencia o prueba)',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Marcar pagado', onPress: () => markPaidMutation.mutate(r.id) },
                            ],
                          )
                        }
                        style={{ marginTop: 10 }}
                      />
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label="Aprobar"
                          size="sm"
                          fullWidth
                          loading={approveMutation.isPending}
                          onPress={() => approveMutation.mutate(r.id)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label="Rechazar"
                          size="sm"
                          variant="ghost"
                          fullWidth
                          loading={rejectMutation.isPending}
                          onPress={() => rejectMutation.mutate(r.id)}
                        />
                      </View>
                    </View>
                  </AppCard>
                );
              })
            )}

            <SectionHeader title="Lista de espera" subtitle={`${waitlist.length}`} dark />
            {waitlist.length === 0 ? (
              <AppCard>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>
                  Sin parejas en espera. Cuando se llenen los cupos, las nuevas inscripciones van acá.
                </Text>
              </AppCard>
            ) : (
              waitlist.map((r) => (
                <AppCard key={r.id}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {r.player1_name} / {r.player2_name}
                  </Text>
                  {r.category ? (
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Cat. {r.category}
                    </Text>
                  ) : null}
                  <View style={{ marginTop: 8 }}>
                    <StatusPill status="WAITLIST" />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Promover"
                        size="sm"
                        fullWidth
                        loading={promoteMutation.isPending}
                        onPress={() => promoteMutation.mutate(r.id)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Rechazar"
                        size="sm"
                        variant="ghost"
                        fullWidth
                        loading={rejectMutation.isPending}
                        onPress={() => rejectMutation.mutate(r.id)}
                      />
                    </View>
                  </View>
                </AppCard>
              ))
            )}

            <SectionHeader title="Parejas aprobadas" subtitle={`${approved.length}`} dark />
            {approved.map((r) => {
              const pay = isOwnerOrganizer ? paymentLabel(r) : null;
              const canMarkPaid =
                isOwnerOrganizer && r.payment_required && r.payment_status !== 'APPROVED';
              return (
                <AppCard key={r.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                        {r.player1_name} / {r.player2_name}
                      </Text>
                      {r.category ? (
                        <Text style={{ color: ui.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                          Cat. {r.category}
                        </Text>
                      ) : null}
                      {pay ? (
                        <Text style={{ color: pay.color, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                          {pay.text}
                        </Text>
                      ) : null}
                    </View>
                    <PrimaryButton
                      label="Quitar"
                      size="sm"
                      variant="ghost"
                      onPress={() => removeRegMutation.mutate(r.id)}
                    />
                  </View>
                  {canMarkPaid ? (
                    <PrimaryButton
                      label="Marcar como pagado"
                      size="sm"
                      variant="outline"
                      fullWidth
                      loading={markPaidMutation.isPending}
                      onPress={() =>
                        Alert.alert(
                          'Confirmar pago',
                          '¿Marcar esta inscripción como pagada? (efectivo, transferencia o prueba)',
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Marcar pagado', onPress: () => markPaidMutation.mutate(r.id) },
                          ],
                        )
                      }
                      style={{ marginTop: 10 }}
                    />
                  ) : null}
                </AppCard>
              );
            })}
          </>
        )}

        {tab === 'matches' && (
          <>
            {!matches?.length ? (
              <EmptyState
                icon={<Ionicons name="tennisball-outline" size={32} color={ui.colors.textMuted} />}
                title="Sin partidos"
                description={
                  isInternal
                    ? 'Armá las parejas y generá el fixture desde la pestaña Parejas, o abrí un partido acá abajo.'
                    : 'Generá el fixture desde la pestaña General.'
                }
              />
            ) : (
              <>
                {!isInternal ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Carga masiva"
                        size="sm"
                        fullWidth
                        onPress={() => router.push(`/tournament/${id}/results` as any)}
                      />
                    </View>
                    {matches.some((m) => m.group_name) ? (
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label="Zonas"
                          size="sm"
                          variant="outline"
                          fullWidth
                          onPress={() => router.push(`/tournament/${id}/zones` as any)}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {hasBracketPhases(matches) ? (
                  <>
                    <TournamentBracketView tournamentId={id!} matches={matches} />
                    <SectionHeader title="Cargar resultados" dark />
                  </>
                ) : null}
                {matches
                  .filter((m) => !isByeMatch(m))
                  .map((m) => {
                    const ready = bothTeamsDefined(m);
                    return (
                      <AppCard key={m.id}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                            {tournamentMatchLabel(m, tournament?.modality)}
                            {m.court_label ? ` · ${m.court_label}` : ''}
                          </Text>
                          <StatusPill status={m.status} size="sm" />
                        </View>
                        <Text style={{ fontWeight: '600', color: ready || m.team_a_registration_id ? ui.colors.textPrimary : ui.colors.textMuted }}>
                          {slotName(m, 'A')}
                        </Text>
                        <Text style={{ fontWeight: '600', color: ready || m.team_b_registration_id ? ui.colors.textPrimary : ui.colors.textMuted, marginTop: 2 }}>
                          {slotName(m, 'B')}
                        </Text>
                        {m.status === 'FINISHED' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={{ color: ui.colors.primary, fontWeight: '800' }}>{formatScore(m)}</Text>
                            <PrimaryButton
                              label="Corregir"
                              size="sm"
                              variant="ghost"
                              loading={clearScoreMutation.isPending && clearScoreMutation.variables === m.id}
                              onPress={() =>
                                Alert.alert(
                                  'Corregir resultado',
                                  'Se borra el resultado para volver a cargarlo. Si la pareja ganadora ya avanzó en el cuadro, se la saca de la ronda siguiente.',
                                  [
                                    { text: 'Cancelar', style: 'cancel' },
                                    {
                                      text: 'Borrar resultado',
                                      style: 'destructive',
                                      onPress: () => clearScoreMutation.mutate(m.id),
                                    },
                                  ],
                                )
                              }
                            />
                          </View>
                        ) : ready ? (
                          <ScoreInput
                            loading={scoreMutation.isPending && scoreMutation.variables?.matchId === m.id}
                            teamAName={m.team_a_name ?? undefined}
                            teamBName={m.team_b_name ?? undefined}
                            onSubmit={(result) => scoreMutation.mutate({ matchId: m.id, result })}
                          />
                        ) : (
                          <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 8 }}>
                            Se habilita cuando estén definidas las dos parejas.
                          </Text>
                        )}
                      </AppCard>
                    );
                  })}
              </>
            )}
            {isInternal ? (
              <View onLayout={(e) => (newMatchY.current = e.nativeEvent.layout.y)}>
                <NewInternalMatchCard
                  tournamentId={id!}
                  pairs={approved}
                  matches={matches ?? []}
                  onCreated={invalidate}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
