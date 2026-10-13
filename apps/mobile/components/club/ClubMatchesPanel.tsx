import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { mapMatch, mapTournament } from '@/lib/mappers';
import type { Match, Tournament } from '@/lib/types';
import { formatShortDate, formatTime } from '@/lib/format';
import {
  approveClubTournamentValidation,
  fetchClubTournamentValidations,
  rejectClubTournamentValidation,
} from '@/lib/tournament/api';
import {
  formatTournamentCategory,
  tournamentOrganizerLabel,
} from '@/lib/tournament/types';
import { getTabScreenPaddingBottom } from '@/lib/layout';
import { ui, fontFamily } from '@/theme/tokens';
import {
  Screen,
  AppCard,
  EmptyState,
  PrimaryButton,
  StatusPill,
  SegmentedControl,
  TournamentCard,
  TabScrollView,
  Avatar,
} from '@/components/x4match';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';

const CLUB_MATCHES_TOUR_STEPS: TourStep[] = [
  {
    target: 'clubMatches.clubPicker',
    title: 'Sede',
    description: 'Si tenés más de una sede, elegí de cuál querés ver la actividad.',
  },
  {
    target: 'clubMatches.sections',
    title: 'Partidos y torneos',
    description:
      'En "Partidos" ves lo que se juega en tus canchas. En "Torneos" validás o rechazás los torneos que los organizadores quieren hacer en tu sede.',
  },
  {
    target: 'clubMatches.filters',
    title: 'Estado de los partidos',
    description:
      '"Abiertos": todavía buscan jugadores. "Confirmados": completos y con el turno pagado. "Historial": partidos ya jugados.',
  },
  {
    target: 'clubMatches.publish',
    title: 'Publicar horario',
    description: 'Publicá un turno libre para que los jugadores lo reserven y armen partido en tu club.',
  },
];

type ClubMainTab = 'matches' | 'tournaments';
type MatchFilter = 'open' | 'upcoming' | 'history';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? LIME : '#161616',
        borderWidth: 1,
        borderColor: active ? LIME : 'rgba(255,255,255,0.10)',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: active ? '#000' : '#FAFAFA',
          fontFamily: fontFamily.regular,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ClubMatchRow({ match, onPress }: { match: Match; onPress: () => void }) {
  const spots = Math.max(0, match.neededPlayers - match.joinedCount);
  return (
    <AppCard onPress={onPress} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontWeight: '700',
              fontSize: 15,
              color: ui.colors.textPrimary,
              fontFamily: fontFamily.regular,
            }}
            numberOfLines={1}
          >
            {match.title}
          </Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, fontFamily: fontFamily.regular }}>
            {formatShortDate(match.date)} · {formatTime(match.date)}
            {match.courtInfo?.label
              ? ` · ${match.courtInfo.label}`
              : match.location
                ? ` · ${match.location}`
                : ''}
          </Text>
        </View>
        <StatusPill status={match.status} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>
          {match.joinedCount}/{match.neededPlayers} jugadores
          {spots > 0 ? ` · faltan ${spots}` : ''}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: LIME }}>Gestionar</Text>
      </View>
    </AppCard>
  );
}

export function ClubMatchesPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const bottomPad = getTabScreenPaddingBottom(insets.bottom);

  const [mainTab, setMainTab] = useState<ClubMainTab>('matches');
  useScreenTour('club-matches', CLUB_MATCHES_TOUR_STEPS, { enabled: mainTab === 'matches' });
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('open');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  const { data: clubs } = useMineClubs(true);
  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId, clubs),
    [selectedClubId, clubs],
  );
  const activeClub = clubs?.find((c) => c.id === activeClubId);

  const {
    data: matchesRaw,
    isLoading: loadingMatches,
    isRefetching: refetchingMatches,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: ['club-matches-panel', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/matches`);
      return res.data;
    },
    enabled: !!activeClubId && mainTab === 'matches',
  });

  const {
    data: tournamentsRaw,
    isLoading: loadingTournaments,
    isRefetching: refetchingTournaments,
    refetch: refetchTournaments,
  } = useQuery({
    queryKey: ['club-tournaments-panel', activeClubId],
    queryFn: async () => {
      const res = await api.get('/tournaments', { params: { includePast: true } });
      return res.data;
    },
    enabled: !!activeClubId && mainTab === 'tournaments',
  });

  const {
    data: pendingValidations,
    isLoading: loadingValidations,
    refetch: refetchValidations,
  } = useQuery({
    queryKey: ['club-tournament-validations', activeClubId],
    queryFn: () => fetchClubTournamentValidations(activeClubId!),
    enabled: !!activeClubId && mainTab === 'tournaments',
  });

  const clubMatches: Match[] = useMemo(
    () => (matchesRaw || []).map(mapMatch),
    [matchesRaw],
  );

  const openMatches = clubMatches.filter((m) => ['OPEN', 'FULL'].includes(m.status));
  const upcomingMatches = clubMatches.filter((m) =>
    ['CONFIRMED', 'IN_PROGRESS'].includes(m.status),
  );
  const historyMatches = clubMatches.filter((m) =>
    ['FINISHED', 'CANCELLED', 'DISPUTED'].includes(m.status),
  );

  const filteredMatches =
    matchFilter === 'open'
      ? openMatches
      : matchFilter === 'upcoming'
        ? upcomingMatches
        : historyMatches;

  const clubTournaments: Tournament[] = useMemo(() => {
    const mapped = (tournamentsRaw || []).map(mapTournament);
    if (!activeClubId) return [];
    return mapped.filter(
      (t) =>
        t.clubId === activeClubId ||
        (activeClub?.name && t.clubName && t.clubName === activeClub.name),
    );
  }, [tournamentsRaw, activeClubId, activeClub?.name]);

  const pendingList = pendingValidations || [];

  const approveTournament = useMutation({
    mutationFn: (tournamentId: string) => approveClubTournamentValidation(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournament-validations', activeClubId] });
      queryClient.invalidateQueries({ queryKey: ['club-tournaments-panel', activeClubId] });
      Alert.alert('Listo', 'Torneo validado');
    },
    onError: (err: any) =>
      Alert.alert('Error', err.response?.data?.message || 'No se pudo validar el torneo'),
  });

  const rejectTournament = useMutation({
    mutationFn: (tournamentId: string) => rejectClubTournamentValidation(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournament-validations', activeClubId] });
      Alert.alert('Listo', 'Torneo rechazado');
    },
    onError: (err: any) =>
      Alert.alert('Error', err.response?.data?.message || 'No se pudo rechazar el torneo'),
  });

  const onRefresh = useCallback(() => {
    if (mainTab === 'matches') {
      void refetchMatches();
      return;
    }
    void refetchTournaments();
    void refetchValidations();
  }, [mainTab, refetchMatches, refetchTournaments, refetchValidations]);

  const refreshing =
    mainTab === 'matches' ? refetchingMatches : refetchingTournaments || loadingValidations;
  const loading = mainTab === 'matches' ? loadingMatches : loadingTournaments;

  if (!clubs?.length) {
    return (
      <Screen>
        <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin sede"
            description="Creá tu club desde Inicio para ver partidos y torneos."
            action={
              <PrimaryButton label="Ir a Inicio" onPress={() => router.push('/(tabs)/home' as any)} />
            }
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TabScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: bottomPad,
        }}
        refreshControl={
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={LIME} />
        }
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: ui.colors.textPrimary,
            fontFamily: fontFamily.regular,
            marginBottom: 4,
          }}
        >
          Actividad
        </Text>
        <Text style={{ fontSize: 13, color: MUTED, marginBottom: 16, fontFamily: fontFamily.regular }}>
          Partidos y torneos de {activeClub?.name || 'tu sede'}
        </Text>

        <TourTarget id="clubMatches.clubPicker">
          <ClubPicker
            selectedClubId={activeClubId}
            onSelect={setSelectedClubId}
            enabled={!!clubs?.length}
          />
        </TourTarget>

        <TourTarget id="clubMatches.sections">
          <SegmentedControl
            value={mainTab}
            onChange={setMainTab}
            options={[
              { value: 'matches', label: 'Partidos' },
              { value: 'tournaments', label: 'Torneos' },
            ]}
          />
        </TourTarget>

        {mainTab === 'matches' ? (
          <View style={{ marginTop: 16 }}>
            <TourTarget
              id="clubMatches.filters"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}
            >
              <FilterChip
                label={`Abiertos (${openMatches.length})`}
                active={matchFilter === 'open'}
                onPress={() => setMatchFilter('open')}
              />
              <FilterChip
                label={`Confirmados (${upcomingMatches.length})`}
                active={matchFilter === 'upcoming'}
                onPress={() => setMatchFilter('upcoming')}
              />
              <FilterChip
                label={`Historial (${historyMatches.length})`}
                active={matchFilter === 'history'}
                onPress={() => setMatchFilter('history')}
              />
            </TourTarget>

            <TourTarget id="clubMatches.publish" style={{ marginBottom: 14 }}>
              <PrimaryButton
                label="Publicar horario"
                fullWidth
                onPress={() => router.push('/(tabs)/court-slots' as any)}
                icon={<Ionicons name="add" size={18} color={ui.colors.onPrimary} />}
              />
            </TourTarget>

            {loading ? (
              <ActivityIndicator color={LIME} style={{ marginTop: 24 }} />
            ) : filteredMatches.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="tennisball-outline" size={28} color={ui.colors.textMuted} />}
                title={
                  matchFilter === 'open'
                    ? 'Sin partidos abiertos'
                    : matchFilter === 'upcoming'
                      ? 'Sin partidos confirmados'
                      : 'Sin historial'
                }
                description={
                  matchFilter === 'open'
                    ? 'Publicá turnos o esperá que se armen partidos en tu sede.'
                    : matchFilter === 'upcoming'
                      ? 'Cuando se confirmen partidos, van a aparecer acá.'
                      : 'Los partidos finalizados de tu sede van a listarse acá.'
                }
                action={
                  matchFilter === 'open' ? (
                    <PrimaryButton
                      label="Ir a horarios"
                      size="sm"
                      onPress={() => router.push('/(tabs)/court-slots' as any)}
                    />
                  ) : undefined
                }
              />
            ) : (
              filteredMatches.map((match) => (
                <ClubMatchRow
                  key={match.id}
                  match={match}
                  onPress={() => router.push(`/match/${match.id}` as any)}
                />
              ))
            )}
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            {pendingList.length > 0 ? (
              <View style={{ marginBottom: 18 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: ui.colors.textPrimary,
                    marginBottom: 4,
                    fontFamily: fontFamily.regular,
                  }}
                >
                  Pendientes de validar
                </Text>
                <Text style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
                  {pendingList.length} torneo{pendingList.length === 1 ? '' : 's'} esperando tu OK
                </Text>
                {pendingList.map((tournament) => {
                  const organizer =
                    tournament.organizer_name?.trim() ||
                    tournamentOrganizerLabel(tournament) ||
                    'Sin organizador';
                  return (
                    <AppCard key={tournament.id} style={{ marginBottom: 10 }}>
                      <Text
                        style={{
                          fontWeight: '800',
                          fontSize: 19,
                          lineHeight: 24,
                          color: ui.colors.textPrimary,
                          fontFamily: fontFamily.regular,
                        }}
                        numberOfLines={2}
                      >
                        {tournament.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: MUTED, marginTop: 4, fontFamily: fontFamily.regular }}>
                        {formatTournamentCategory(tournament.category, tournament.gender)}
                        {tournament.start_date ? ` · ${formatShortDate(tournament.start_date)}` : ''}
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.75}
                        disabled={!tournament.organizer_user_id}
                        onPress={() => router.push(`/player/${tournament.organizer_user_id}` as any)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver perfil de ${organizer}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 14,
                          marginBottom: 14,
                          padding: 12,
                          borderRadius: 16,
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <Avatar
                          name={organizer}
                          photo={tournament.organizer_photo_url}
                          size="md"
                          style={{ marginBottom: 0 }}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={{
                              fontSize: 11,
                              letterSpacing: 1,
                              fontWeight: '700',
                              color: MUTED,
                              fontFamily: fontFamily.regular,
                            }}
                          >
                            ORGANIZA
                          </Text>
                          <Text
                            style={{
                              fontSize: 17,
                              fontWeight: '700',
                              color: ui.colors.textPrimary,
                              marginTop: 2,
                              fontFamily: fontFamily.regular,
                            }}
                            numberOfLines={1}
                          >
                            {organizer}
                          </Text>
                        </View>
                        {tournament.organizer_user_id ? (
                          <Ionicons name="chevron-forward" size={18} color={MUTED} />
                        ) : null}
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Rechazar"
                            variant="outline"
                            size="sm"
                            fullWidth
                            loading={rejectTournament.isPending}
                            onPress={() => {
                              Alert.alert('Rechazar torneo', `¿Rechazar "${tournament.name}"?`, [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                  text: 'Rechazar',
                                  style: 'destructive',
                                  onPress: () => rejectTournament.mutate(tournament.id),
                                },
                              ]);
                            }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Validar"
                            size="sm"
                            fullWidth
                            loading={approveTournament.isPending}
                            onPress={() => approveTournament.mutate(tournament.id)}
                          />
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => router.push(`/tournament/${tournament.id}` as any)}
                        style={{ marginTop: 10, alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: LIME }}>Ver detalle</Text>
                      </TouchableOpacity>
                    </AppCard>
                  );
                })}
              </View>
            ) : null}

            <Text
              style={{
                fontSize: 16,
                fontWeight: '800',
                color: ui.colors.textPrimary,
                marginBottom: 4,
                fontFamily: fontFamily.regular,
              }}
            >
              Torneos en tu sede
            </Text>
            <Text style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>
              {clubTournaments.length} publicado{clubTournaments.length === 1 ? '' : 's'}
            </Text>

            {loading ? (
              <ActivityIndicator color={LIME} style={{ marginTop: 24 }} />
            ) : clubTournaments.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="trophy-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin torneos"
                description="Cuando organicen torneos en tu sede, van a aparecer acá para seguimiento y validación."
              />
            ) : (
              clubTournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  ctaLabel="Ver torneo"
                  onPress={() => router.push(`/tournament/${tournament.id}` as any)}
                  style={{ marginBottom: 12, width: '100%' }}
                />
              ))
            )}
          </View>
        )}
      </TabScrollView>
    </Screen>
  );
}
