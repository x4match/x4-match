import { View, Text, ScrollView, Alert, TextInput, Share, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  setMatchScore,
  updateMatch,
  formatScore,
  fetchTournamentInvites,
  inviteTournamentPlayers,
  revokeTournamentInvite,
  buildTournamentInviteLink,
  deleteTournamentPhoto,
} from '@/lib/tournament/api';
import {
  FIXED_CATEGORY_OPTIONS,
  getTournamentCategoryMode,
  parseSumCategoryCap,
  teamFitsSumCap,
  teamSumOrdinal,
  clubValidationLabel,
  type TournamentRegistration,
} from '@/lib/tournament/types';
import {
  getTournamentFlyer,
  pickTournamentFlyer,
  showFlyerPickerOptions,
  uploadTournamentFlyer,
} from '@/lib/tournament-flyer';
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
} from '@/components/padely';

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

function ScoreInput({ onSubmit, loading }: { onSubmit: (sets: { teamA: number; teamB: number }[]) => void; loading?: boolean }) {
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
          ].filter((s, idx) => idx < 2 || s.teamA || s.teamB);
          onSubmit(sets);
        }}
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tournament-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-registrations', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-matches', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-standings', id] });
    queryClient.invalidateQueries({ queryKey: ['tournament-invites', id] });
  };

  const { data: tournament } = useQuery({
    queryKey: ['tournament-detail', id],
    queryFn: () => fetchTournamentDetail(id!),
    enabled: !!id,
  });

  const canManage =
    !!user?.id &&
    canOrganizeEvents(user.role) &&
    (!tournament ||
      tournament.organizer_user_id === user.id ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'CLUB_ADMIN');
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

  const flyerMutation = useMutation({
    mutationFn: async (action: { type: 'upload'; dataUrl: string } | { type: 'remove'; photoId: string }) => {
      if (action.type === 'remove') {
        await deleteTournamentPhoto(id!, action.photoId);
        return;
      }
      const current = getTournamentFlyer(tournament?.photos);
      await uploadTournamentFlyer(id!, action.dataUrl, current?.id);
    },
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo actualizar el flyer'),
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
    mutationFn: (mode: 'ROUND_ROBIN' | 'SINGLE_ELIMINATION' | 'OPEN_COURT') =>
      generateFixture(id!, { mode, reset: true }),
    onSuccess: () => {
      Alert.alert('Fixture generado', 'Se crearon los partidos y el torneo pasó a "En juego".');
      invalidate();
      setTab('matches');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo generar'),
  });

  const scoreMutation = useMutation({
    mutationFn: ({ matchId, sets }: { matchId: string; sets: { teamA: number; teamB: number }[] }) =>
      setMatchScore(id!, matchId, sets),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'No se pudo cargar'),
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

  const pending = (registrations || []).filter((r) => r.status === 'PENDING');
  const waitlist = (registrations || []).filter((r) => r.status === 'WAITLIST');
  const approved = (registrations || []).filter((r) => r.status === 'APPROVED');
  const flyer = getTournamentFlyer(tournament?.photos);

  return (
    <Screen>
      <StackHeader title="Gestionar torneo" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {(
            [
              { key: 'general' as const, label: 'General' },
              { key: 'dates' as const, label: 'Fechas' },
              { key: 'teams' as const, label: `Inscriptos${pending.length || waitlist.length ? ` (${pending.length + waitlist.length})` : ''}` },
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
              {isExternal && tournament.club_validation_status ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: ui.colors.textSecondary }}>
                  {clubValidationLabel(tournament.club_validation_status)}
                  {tournament.club_name ? ` · ${tournament.club_name}` : ''}
                </Text>
              ) : null}
              {isInternal ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: ui.colors.textSecondary }}>
                  Torneo privado: solo invitados pueden verlo e inscribirse.
                </Text>
              ) : null}
            </AppCard>

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
                      if (picked) flyerMutation.mutate({ type: 'upload', dataUrl: picked.dataUrl });
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

            {isExternal && tournament.club_validation_status === 'PENDING' ? (
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                  Esperando que un admin de {tournament.club_name || 'el club'} valide el torneo. Hasta entonces no
                  aparece en el listado público.
                </Text>
              </AppCard>
            ) : null}

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

            <SectionHeader title="Fixture" subtitle={`${approved.length} parejas aprobadas`} dark />
            <AppCard>
              <Text style={{ color: ui.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Generá los partidos automáticamente con las parejas aprobadas.
                {tournament?.format === 'OPEN_COURT'
                  ? ' En cancha abierta se arman turnos según las canchas disponibles.'
                  : ''}
              </Text>
              {tournament?.format === 'OPEN_COURT' ? (
                <PrimaryButton
                  label="Generar cancha abierta"
                  fullWidth
                  loading={fixtureMutation.isPending}
                  onPress={() => fixtureMutation.mutate('OPEN_COURT')}
                  style={{ marginBottom: 8 }}
                />
              ) : null}
              <PrimaryButton
                label="Todos contra todos"
                fullWidth={tournament?.format !== 'OPEN_COURT'}
                variant={tournament?.format === 'OPEN_COURT' ? 'outline' : undefined}
                loading={fixtureMutation.isPending}
                onPress={() => fixtureMutation.mutate('ROUND_ROBIN')}
                style={{ marginBottom: 8 }}
              />
              <PrimaryButton
                label="Eliminación directa"
                variant="outline"
                fullWidth
                loading={fixtureMutation.isPending}
                onPress={() => fixtureMutation.mutate('SINGLE_ELIMINATION')}
                style={tournament?.format === 'OPEN_COURT' ? { marginBottom: 8 } : undefined}
              />
              {tournament?.format !== 'OPEN_COURT' ? (
                <PrimaryButton
                  label="Cancha abierta"
                  variant="outline"
                  fullWidth
                  loading={fixtureMutation.isPending}
                  onPress={() => fixtureMutation.mutate('OPEN_COURT')}
                />
              ) : null}
            </AppCard>

            <SectionHeader title="Estado del torneo" dark />
            <AppCard>
              <PrimaryButton
                label="Marcar como finalizado"
                variant="outline"
                fullWidth
                loading={statusMutation.isPending}
                onPress={() => statusMutation.mutate('FINISHED')}
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
            <SectionHeader title="Agregar fecha" dark />
            <AppCard>
              <DateTimeField label="Fecha" mode="date" value={dateValue} onChange={setDateValue} minimumDate={new Date()} />
              <DateTimeField label="Hora" mode="time" value={timeValue} onChange={setTimeValue} />
              <InputField label="Etiqueta (opcional)" value={dateLabel} onChangeText={setDateLabel} placeholder="Fase de grupos" />
              <PrimaryButton
                label="Agregar fecha"
                fullWidth
                loading={addDateMutation.isPending}
                onPress={() => {
                  if (!dateValue) {
                    Alert.alert('Falta la fecha', 'Seleccioná la fecha del torneo.');
                    return;
                  }
                  addDateMutation.mutate();
                }}
              />
            </AppCard>

            <SectionHeader title="Fechas cargadas" dark />
            {!tournament?.dates?.length ? (
              <AppCard>
                <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Todavía no hay fechas.</Text>
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

        {tab === 'teams' && (
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
                description="Generá el fixture desde la pestaña General."
              />
            ) : (
              matches.map((m) => (
                <AppCard key={m.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                      {m.round_label || `Ronda ${m.round}`}
                      {m.court_label ? ` · ${m.court_label}` : ''}
                    </Text>
                    <StatusPill status={m.status} size="sm" />
                  </View>
                  <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{m.team_a_name || 'TBD'}</Text>
                  <Text style={{ fontWeight: '600', color: ui.colors.textPrimary, marginTop: 2 }}>{m.team_b_name || 'TBD'}</Text>
                  {m.status === 'FINISHED' ? (
                    <Text style={{ color: ui.colors.primary, fontWeight: '800', marginTop: 6 }}>{formatScore(m)}</Text>
                  ) : (
                    <ScoreInput
                      loading={scoreMutation.isPending}
                      onSubmit={(sets) => scoreMutation.mutate({ matchId: m.id, sets })}
                    />
                  )}
                </AppCard>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
