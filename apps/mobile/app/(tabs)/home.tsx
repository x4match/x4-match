import { ScrollView, Text, RefreshControl, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isClub, canOrganizeEvents, isPlayer } from '@/lib/roles';
import { api } from '@/lib/api';
import { mapMatch, mapPlayer, mapTournament, safeMapCircuit } from '@/lib/mappers';
import type { Circuit, CircuitRankingEntry, Match, Player, Tournament } from '@/lib/types';
import { formatShortDate, formatTime, formatPlayPeriodLabel } from '@/lib/format';
import { formatSkillRange, matchOverlapsCategory, playerSkillFitsMatchRange, resolveSkillScore } from '@/lib/skill';
import { playerFitsTournamentCategory } from '@/lib/tournament/types';
import { formatDistanceKm, requestPlayerCoordinates, syncPlayerCoordinates } from '@/lib/geolocation';
import { invalidateRedeemablePoints, useRedeemablePoints } from '@/lib/redeemable-points';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  SectionHeader,
  StatusPill,
  PrimaryButton,
  Avatar,
  FadeInUp,
  SkeletonCard,
  EmptyState,
  PressableScale,
  InputField,
} from '@/components/padely';

type ClubLeaderboardEntry = {
  user_id: string;
  name: string;
  nickname?: string;
  photo_url?: string;
  points: number;
  matches_at_club: number;
  rank: number | string;
};

type ClubDashboard = {
  openSlots: number;
  slotsThisWeek: number;
  bonusPointsOffered: number;
  uniquePlayers30d: number;
  matchesFinished30d: number;
  activeMatches: number;
  rotationIndex: number;
};

type CourtSlotRow = {
  id: string;
  court_label: string;
  slot_date: string;
  start_hour: number;
  end_hour: number;
  status: string;
  bonus_points?: number;
};

function formatSlotTime(hour: number) {
  const minutes = Math.round(hour * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function todayDateKey() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

type ClubOption = { id: string; name: string; city?: string; zone?: string; logo_url?: string };

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();
  const isClubAccount = isClub(user?.role);
  const isEventOrganizerAccount = canOrganizeEvents(user?.role);
  const isPlayerAccount = isPlayer(user?.role);

  const { data: playerProfile, refetch: refetchPlayerProfile } = useQuery({
    queryKey: ['home-player-profile'],
    queryFn: async () => {
      const res = await api.get('/users/profile');
      return res.data as {
        mainClubId?: string;
        mainClub?: { id: string; name: string; zone?: string };
        levelCategory?: string;
        categoryStatus?: 'provisional' | 'confirmed';
        declaredCategory?: string;
      };
    },
    enabled: isPlayerAccount,
  });

  const playerMainClubId = (() => {
    const raw = playerProfile?.mainClubId ?? user?.mainClubId;
    if (
      !raw ||
      raw === 'undefined' ||
      raw === 'null' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ) {
      return undefined;
    }
    return raw;
  })();
  const playerLevelCategory = playerProfile?.levelCategory ?? user?.levelCategory;
  const playerCategoryStatus = playerProfile?.categoryStatus ?? user?.categoryStatus;
  const playerDeclaredCategory =
    playerProfile?.declaredCategory ?? user?.declaredCategory ?? playerLevelCategory;
  const [showMoreHome, setShowMoreHome] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [playerCoords, setPlayerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [usingGeoLocation, setUsingGeoLocation] = useState(false);

  useEffect(() => {
    if (!isPlayerAccount) {
      setLocationReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const coords = await requestPlayerCoordinates();
      if (cancelled) return;

      if (coords) {
        setPlayerCoords({ lat: coords.latitude, lng: coords.longitude });
        setUsingGeoLocation(true);
        syncPlayerCoordinates(coords).catch(() => undefined);
      }

      setLocationReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isPlayerAccount]);

  const { data: feed, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ['home-open-matches', playerCoords?.lat, playerCoords?.lng],
    queryFn: async () => {
      const res = await api.get('/matches/open', {
        params: {
          radiusKm: 30,
          lat: playerCoords?.lat,
          lng: playerCoords?.lng,
        },
      });
      return {
        openMatches: res.data?.matches || [],
        category: res.data?.category,
      };
    },
    enabled: !isClubAccount,
  });

  const { data: nearbyPlayers, refetch: refetchNearby, isLoading: loadingNearby } = useQuery({
    queryKey: ['community-nearby-players', playerCoords?.lat, playerCoords?.lng],
    queryFn: async () => {
      const res = await api.get('/community/players-nearby', {
        params: playerCoords
          ? { lat: playerCoords.lat, lng: playerCoords.lng, radiusKm: 30 }
          : undefined,
      });
      return res.data;
    },
    enabled: isPlayerAccount && locationReady,
  });

  const { data: homeClubs, refetch: refetchHomeClubs, isLoading: loadingHomeClubs } = useQuery({
    queryKey: ['clubs-home-search'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data as ClubOption[];
    },
    enabled: isEventOrganizerAccount && !isClubAccount,
  });

  const { data: tournaments, refetch: refetchTournaments } = useQuery({
    queryKey: ['tournaments-home'],
    queryFn: async () => {
      const res = await api.get('/tournaments');
      return res.data;
    },
    enabled: !isClubAccount,
  });

  const { data: myMatches, refetch: refetchMatches } = useQuery({
    queryKey: ['my-matches'],
    queryFn: async () => {
      const res = await api.get('/matches/me');
      return res.data;
    },
    enabled: isPlayerAccount,
  });

  const { data: playerMe, refetch: refetchPlayerMe } = useQuery({
    queryKey: ['home-player-me'],
    queryFn: async () => {
      const res = await api.get('/players/me');
      return res.data;
    },
    enabled: isPlayerAccount,
  });

  const { data: playerMainClubFetched, refetch: refetchPlayerMainClub } = useQuery({
    queryKey: ['player-home-main-club', playerMainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${playerMainClubId}`);
      return res.data as ClubOption;
    },
    enabled: isPlayerAccount && !!playerMainClubId,
  });

  const playerMainClub = playerProfile?.mainClub ?? playerMainClubFetched ?? null;

  const { data: clubOptions, refetch: refetchClubOptions } = useQuery({
    queryKey: ['clubs-home-picker'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data as ClubOption[];
    },
    enabled: isPlayerAccount && !playerMainClubId,
  });

  const { data: playerClubLeaderboard, refetch: refetchPlayerClubLeaderboard } = useQuery({
    queryKey: ['player-home-club-leaderboard', playerMainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${playerMainClubId}/leaderboard`);
      return res.data as ClubLeaderboardEntry[];
    },
    enabled: isPlayerAccount && !!playerMainClubId,
  });

  const { data: playerClubPoints, refetch: refetchPlayerClubPoints } = useRedeemablePoints(
    playerMainClubId,
    isPlayerAccount,
  );

  const { data: circuits, refetch: refetchCircuits } = useQuery({
    queryKey: ['circuits-home-player'],
    queryFn: async () => {
      const res = await api.get('/circuits');
      return res.data;
    },
    enabled: isPlayerAccount,
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs-home'],
    queryFn: async () => {
      const res = await api.get('/clubs/mine');
      return res.data;
    },
    enabled: isClubAccount,
  });

  const mainClubId = isClubAccount ? clubs?.[0]?.id : undefined;

  const { data: clubDashboard, refetch: refetchDashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['club-dashboard-home', mainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${mainClubId}/dashboard`);
      return res.data as ClubDashboard;
    },
    enabled: isClubAccount && !!mainClubId,
  });

  const { data: clubCourtSlots, refetch: refetchClubSlots, isLoading: loadingClubSlots } = useQuery({
    queryKey: ['club-home-court-slots', mainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${mainClubId}/court-slots`);
      return res.data as CourtSlotRow[];
    },
    enabled: isClubAccount && !!mainClubId,
  });

  const { data: clubMatchesRaw, refetch: refetchClubMatches, isLoading: loadingClubMatches } = useQuery({
    queryKey: ['club-home-matches', mainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${mainClubId}/matches`);
      return res.data;
    },
    enabled: isClubAccount && !!mainClubId,
  });

  const playerCircuitList: Circuit[] = ((circuits as any[]) || [])
    .map(safeMapCircuit)
    .filter((c): c is Circuit => c != null && Boolean(c.id));
  const featuredCircuit = useMemo(
    () => playerCircuitList.find((c) => c.status === 'ACTIVE') || playerCircuitList[0] || null,
    [playerCircuitList],
  );

  const { data: featuredCircuitRaw, refetch: refetchFeaturedCircuit } = useQuery({
    queryKey: ['player-home-featured-circuit', featuredCircuit?.id],
    queryFn: async () => {
      const res = await api.get(`/circuits/${featuredCircuit?.id}`);
      return res.data;
    },
    enabled: isPlayerAccount && !!featuredCircuit?.id,
  });

  const featuredCircuitDetail = featuredCircuitRaw ? safeMapCircuit(featuredCircuitRaw) : null;
  const featuredCategoryId = useMemo(
    () =>
      featuredCircuitDetail?.categories?.find((category) => category.label === playerLevelCategory)?.id ??
      null,
    [featuredCircuitDetail?.categories, playerLevelCategory],
  );
  const categoryRanking: CircuitRankingEntry[] = useMemo(() => {
    if (!featuredCircuitDetail?.rankings?.length) return [];
    if (!playerLevelCategory) return featuredCircuitDetail.rankings;
    return featuredCircuitDetail.rankings.filter((entry) => entry.categoryLabel === playerLevelCategory);
  }, [featuredCircuitDetail?.rankings, playerLevelCategory]);
  const topCategoryRanking = categoryRanking.slice(0, 3);
  const myCategoryEntry = useMemo(
    () => categoryRanking.find((entry) => entry.playerId === playerMe?.id) ?? null,
    [categoryRanking, playerMe?.id],
  );
  const myClubEntry = useMemo(
    () => playerClubLeaderboard?.find((entry) => entry.user_id === user?.id) ?? null,
    [playerClubLeaderboard, user?.id],
  );

  const setMainClubMutation = useMutation({
    mutationFn: (clubId: string) => api.patch('/users/profile', { mainClubId: clubId }),
    onSuccess: async (_, clubId) => {
      await updateUser({ mainClubId: clubId });
      queryClient.invalidateQueries({ queryKey: ['home-player-profile'] });
      queryClient.invalidateQueries({ queryKey: ['player-home-main-club', clubId] });
      queryClient.invalidateQueries({ queryKey: ['player-home-club-leaderboard', clubId] });
      invalidateRedeemablePoints(queryClient);
      refetchPlayerProfile();
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo guardar tu club principal');
    },
  });

  const openClubRanking = useCallback(() => {
    if (playerMainClubId) {
      router.push(`/club/${playerMainClubId}?tab=ranking` as any);
      return;
    }
    router.push('/(tabs)/clubs' as any);
  }, [playerMainClubId, router]);

  const openCategoryRanking = useCallback(() => {
    if (featuredCircuit?.id) {
      const suffix = featuredCategoryId ? `?categoryId=${featuredCategoryId}` : '';
      router.push(`/circuit/${featuredCircuit.id}${suffix}` as any);
      return;
    }
    router.push('/(tabs)/rankings' as any);
  }, [featuredCategoryId, featuredCircuit?.id, router]);

  const onRefresh = useCallback(() => {
    refetchFeed();
    refetchTournaments();
    if (isPlayerAccount) {
      refetchNearby();
      refetchMatches();
      refetchPlayerMe();
      refetchPlayerProfile();
      refetchPlayerMainClub();
      refetchPlayerClubLeaderboard();
      refetchPlayerClubPoints();
      refetchCircuits();
      if (!playerMainClubId) refetchClubOptions();
      if (featuredCircuit?.id) refetchFeaturedCircuit();
    }
    if (isEventOrganizerAccount && !isClubAccount) {
      refetchHomeClubs();
    }
    if (isClubAccount) {
      refetchDashboard();
      refetchClubSlots();
      refetchClubMatches();
    }
  }, [
    featuredCircuit?.id,
    isClubAccount,
    isEventOrganizerAccount,
    isPlayerAccount,
    refetchCircuits,
    refetchClubMatches,
    refetchClubSlots,
    refetchDashboard,
    refetchFeed,
    refetchFeaturedCircuit,
    refetchHomeClubs,
    refetchMatches,
    refetchNearby,
    playerMainClubId,
    refetchClubOptions,
    refetchPlayerClubLeaderboard,
    refetchPlayerClubPoints,
    refetchPlayerMainClub,
    refetchPlayerMe,
    refetchPlayerProfile,
    refetchTournaments,
  ]);

  const openMatches: Match[] = (feed?.openMatches || []).map(mapMatch);

  const playerSkillScore = resolveSkillScore(
    playerMe?.skillScore ?? playerMe?.skill_score,
    playerMe?.rating ?? user?.skillScore,
  );

  const joinableOpenMatches = useMemo(() => {
    if (!isPlayerAccount) return [];
    return openMatches.filter((match) => {
      if (match.status !== 'OPEN') return false;
      if (match.joinedCount >= match.neededPlayers) return false;
      if (match.createdByUserId && match.createdByUserId === user?.id) return false;
      if (match.players?.some((player) => player.id === user?.id)) return false;
      return true;
    });
  }, [isPlayerAccount, openMatches, user?.id]);

  const communityOpenMatches = useMemo(() => {
    if (!isPlayerAccount) return openMatches;
    const featuredIds = new Set(joinableOpenMatches.map((match) => match.id));
    return openMatches.filter((match) => !featuredIds.has(match.id));
  }, [isPlayerAccount, joinableOpenMatches, openMatches]);

  const filteredHomeClubs = useMemo(() => {
    const q = clubSearch.trim().toLowerCase();
    const list = homeClubs || [];
    if (!q) return list.slice(0, 6);
    return list
      .filter((club) => {
        const haystack = [club.name, club.city, club.zone].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [clubSearch, homeClubs]);

  const players: Player[] = (nearbyPlayers || []).slice(0, 5).map(mapPlayer);
  const tournamentList: Tournament[] = (tournaments || []).map(mapTournament);
  const playableTournaments = isPlayerAccount
    ? tournamentList.filter((t) => playerFitsTournamentCategory(playerLevelCategory, t.category))
    : tournamentList;
  const upcomingTournaments = playableTournaments.filter((t) => t.status === 'OPEN_REGISTRATION').slice(0, 3);
  const upcomingMatches: Match[] = (myMatches || [])
    .map(mapMatch)
    .filter((m: Match) => ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS'].includes(m.status));

  const clubHomeLoading =
    isClubAccount && (loadingDashboard || loadingClubSlots || loadingClubMatches);

  const openCourtSlots = (clubCourtSlots || []).filter(
    (slot) => slot.status === 'OPEN' && slot.slot_date >= todayDateKey(),
  );
  const clubMatches: Match[] = (clubMatchesRaw || []).map(mapMatch);
  const clubOpenMatches = clubMatches.filter((m) => ['OPEN', 'FULL'].includes(m.status));
  const clubUpcomingMatches = clubMatches.filter((m) => ['CONFIRMED', 'IN_PROGRESS'].includes(m.status));
  const mainClubName = clubs?.[0]?.name;

  return (
    <Screen>
      <AppHeader showUserGreeting showNotifications />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={
          <RefreshControl refreshing={isClubAccount ? !!clubHomeLoading : feedLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />
        }
      >
        {isClubAccount ? (
          <>
            <SectionHeader
              title="Panel resumido"
              subtitle={mainClubName || 'Tu club'}
              action={
                <PressableScale onPress={() => router.push('/(tabs)/court-slots' as any)} accessibilityRole="button" accessibilityLabel="Gestión de horarios">
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>Gestión</Text>
                </PressableScale>
              }
            />
            {clubDashboard ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: ui.spacing.lg }}>
                <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                  <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.primary }}>{clubDashboard.openSlots}</Text>
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 4 }}>Horarios abiertos</Text>
                </AppCard>
                <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                  <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.textPrimary }}>{clubDashboard.activeMatches}</Text>
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 4 }}>Partidos activos</Text>
                </AppCard>
                <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                  <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.textPrimary }}>{clubDashboard.uniquePlayers30d}</Text>
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 4 }}>Jugadores 30d</Text>
                </AppCard>
                <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                  <Text style={{ fontSize: 22, fontWeight: '800', color: ui.colors.accent }}>{clubDashboard.rotationIndex}%</Text>
                  <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 4 }}>Rotación 30d</Text>
                </AppCard>
              </View>
            ) : (
              <SkeletonCard style={{ marginBottom: ui.spacing.lg }} />
            )}

            <SectionHeader
              title="Horarios abiertos"
              subtitle={`${openCourtSlots.length} publicados`}
              action={
                <PressableScale onPress={() => router.push('/(tabs)/court-slots' as any)} accessibilityRole="button" accessibilityLabel="Gestionar horarios">
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>Gestionar</Text>
                </PressableScale>
              }
            />
            {openCourtSlots.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="time-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin horarios abiertos"
                description="Publicá turnos para llenar canchas."
                action={
                  <PrimaryButton
                    label="Publicar horario"
                    onPress={() => router.push('/(tabs)/court-slots' as any)}
                    icon={<Ionicons name="add" size={16} color="#fff" />}
                  />
                }
              />
            ) : (
              openCourtSlots.slice(0, 5).map((slot) => (
                <AppCard
                  key={slot.id}
                  onPress={() => router.push('/(tabs)/court-slots' as any)}
                  style={{ marginBottom: 8 }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{slot.court_label}</Text>
                      <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 4 }}>
                        {formatShortDate(slot.slot_date)} · {formatSlotTime(slot.start_hour)}–{formatSlotTime(slot.end_hour)}
                      </Text>
                    </View>
                  </View>
                </AppCard>
              ))
            )}

            <SectionHeader title="Partidos abiertos" subtitle={`${clubOpenMatches.length} buscando jugadores`} />
            {clubOpenMatches.length === 0 ? (
              <AppCard style={{ marginBottom: ui.spacing.lg }}>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>No hay partidos abiertos en tu club.</Text>
              </AppCard>
            ) : (
              clubOpenMatches.slice(0, 5).map((match) => (
                <AppCard key={match.id} onPress={() => router.push(`/match/${match.id}` as any)} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }} numberOfLines={1}>
                        {match.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>
                        {formatShortDate(match.date)} · {formatTime(match.date)}
                      </Text>
                    </View>
                    <StatusPill status={match.status} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>
                    {match.joinedCount}/{match.neededPlayers} jugadores
                  </Text>
                </AppCard>
              ))
            )}

            <SectionHeader title="Próximos partidos" subtitle={`${clubUpcomingMatches.length} confirmados`} />
            {clubUpcomingMatches.length === 0 ? (
              <AppCard>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>No hay partidos confirmados próximos.</Text>
              </AppCard>
            ) : (
              clubUpcomingMatches.slice(0, 5).map((match) => (
                <AppCard key={match.id} onPress={() => router.push(`/match/${match.id}` as any)} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{match.title}</Text>
                    <StatusPill status={match.status} />
                  </View>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                    {formatShortDate(match.date)} · {formatTime(match.date)}
                  </Text>
                </AppCard>
              ))
            )}
          </>
        ) : isPlayer(user?.role) ? (
          <FadeInUp index={0}>
            <AppCard variant="gradient" glow padding="lg" style={{ marginBottom: ui.spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[ui.typography.h2, { color: ui.colors.textPrimary, marginBottom: 4 }]}>Jugar ahora</Text>
                  <Text style={[ui.typography.bodySm, { color: ui.colors.textSecondary }]}>
                    Encontrá un partido hoy en segundos
                  </Text>
                </View>
                <PrimaryButton
                  label="Buscar"
                  onPress={() => router.push('/browse-open-matches' as any)}
                  variant="accent"
                  size="md"
                  icon={<Ionicons name="play" size={18} color="#0A0A0A" />}
                />
              </View>
            </AppCard>
          </FadeInUp>
        ) : null}

        {isPlayerAccount && (
          <>
            <SectionHeader
              title="Partidos abiertos"
              subtitle={
                playerLevelCategory
                  ? `${joinableOpenMatches.length} para sumarte · tu cat. ${playerLevelCategory}`
                  : `${joinableOpenMatches.length} abiertos para sumarte`
              }
              action={
                <PressableScale onPress={() => router.push('/browse-open-matches' as any)} accessibilityRole="button" accessibilityLabel="Buscar más partidos">
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>Buscar más</Text>
                </PressableScale>
              }
            />
            {feedLoading && joinableOpenMatches.length === 0 ? (
              <SkeletonCard style={{ marginBottom: ui.spacing.lg }} />
            ) : joinableOpenMatches.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="tennisball-outline" size={28} color={ui.colors.textMuted} />}
                title="Sin partidos abiertos"
                description="Creá uno o volvé más tarde para sumarte"
                action={
                  <PrimaryButton
                    label="Crear partido abierto"
                    onPress={() => router.push('/create-open-match' as any)}
                    size="sm"
                    icon={<Ionicons name="add-circle-outline" size={16} color="#fff" />}
                  />
                }
              />
            ) : (
              joinableOpenMatches.slice(0, 3).map((match, index) => {
                const requiresApproval =
                  playerCategoryStatus === 'provisional' && playerDeclaredCategory
                    ? !matchOverlapsCategory(match.levelMin, match.levelMax, playerDeclaredCategory)
                    : !playerSkillFitsMatchRange(
                        playerSkillScore,
                        match.levelMin,
                        match.levelMax,
                      );
                return (
                  <FadeInUp key={match.id} index={index + 1}>
                    <AppCard
                      onPress={() => router.push(`/match/${match.id}` as any)}
                      style={{ marginBottom: 8 }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text
                            style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }}
                            numberOfLines={1}
                          >
                            {match.title}
                          </Text>
                          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                            {match.club?.name || match.zone || 'Sin club'}
                          </Text>
                        </View>
                        <StatusPill status={match.status} />
                      </View>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 6 }}>
                        {formatShortDate(match.date)} · {formatPlayPeriodLabel(match.date, match.endsAt)}
                      </Text>
                      {(match.levelMin != null || match.levelMax != null) && (
                        <Text style={{ fontSize: 11, color: ui.colors.primary, fontWeight: '600', marginBottom: 10 }}>
                          {formatSkillRange(match.levelMin, match.levelMax)}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>
                          {match.neededPlayers - match.joinedCount} lugar
                          {match.neededPlayers - match.joinedCount === 1 ? '' : 'es'} libre
                          {match.neededPlayers - match.joinedCount === 1 ? '' : 's'} · {match.joinedCount}/
                          {match.neededPlayers}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.primary }}>
                            {requiresApproval ? 'Solicitar' : 'Ver y unirme'}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={ui.colors.primary} />
                        </View>
                      </View>
                    </AppCard>
                  </FadeInUp>
                );
              })
            )}
          </>
        )}

        {!isClubAccount && isPlayerAccount && (
          <>
            <SectionHeader
              title="Ranking"
              subtitle="Por categoría y club"
              action={
                <PressableScale onPress={() => router.push('/(tabs)/rankings' as any)} accessibilityRole="button" accessibilityLabel="Ver circuitos">
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>Ver circuitos</Text>
                </PressableScale>
              }
            />
            <View style={{ gap: 12, marginBottom: ui.spacing.lg }}>
              <AppCard onPress={playerMainClubId ? openClubRanking : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Ranking de club</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                      {playerMainClub ? playerMainClub.name : 'Elegí tu club principal'}
                    </Text>
                  </View>
                  <Ionicons name="business-outline" size={22} color={ui.colors.primary} />
                </View>
                {playerMainClubId ? (
                  <>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        padding: 10,
                        borderRadius: ui.radius.md,
                        backgroundColor: ui.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: ui.colors.border,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Puntos globales canjeables</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.primary, marginTop: 2 }}>
                          {playerClubPoints?.points ?? 0} pts
                        </Text>
                      </View>
                      <PrimaryButton
                        label="Ver premios"
                        size="sm"
                        onPress={() => router.push(`/club/${playerMainClubId}?tab=rewards` as any)}
                      />
                    </View>
                    <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 10 }}>
                      {myClubEntry
                        ? `Vas #${myClubEntry.rank} este mes con ${myClubEntry.points} pts.`
                        : `Llevás ${playerClubPoints?.monthlyPoints ?? 0} pts este mes${playerClubPoints?.monthlyMatchesPlayed
                          ? ` en ${playerClubPoints.monthlyMatchesPlayed} partido${playerClubPoints.monthlyMatchesPlayed === 1 ? '' : 's'}`
                          : ''
                        }.`}
                    </Text>
                    {(playerClubLeaderboard || []).slice(0, 3).map((entry) => (
                      <PressableScale
                        key={entry.user_id}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver perfil de ${entry.nickname || entry.name}`}
                        onPress={() => router.push(`/player/${entry.user_id}` as any)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 6,
                          minHeight: 44,
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: ui.colors.primary, width: 28 }}>#{entry.rank}</Text>
                        <Text style={{ flex: 1, color: ui.colors.textPrimary }} numberOfLines={1}>
                          {entry.nickname || entry.name}
                          {entry.user_id === user?.id ? ' (vos)' : ''}
                        </Text>
                        <Text style={{ color: ui.colors.textSecondary, fontWeight: '700' }}>{entry.points} pts</Text>
                      </PressableScale>
                    ))}
                    {(playerClubLeaderboard || []).length === 0 ? (
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
                        Todavía no hay ranking en tu club. Jugá partidos ahí para empezar a sumar.
                      </Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: ui.colors.primary }}>Ver ranking completo</Text>
                        <Ionicons name="chevron-forward" size={14} color={ui.colors.primary} />
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 13, color: ui.colors.textMuted, marginBottom: 12 }}>
                      Elegí tu club principal para seguir tu posición mensual y acceder al ranking interno.
                    </Text>
                    {(clubOptions || []).slice(0, 4).map((club) => (
                      <PressableScale
                        key={club.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Elegir club ${club.name}`}
                        disabled={setMainClubMutation.isPending}
                        onPress={() => setMainClubMutation.mutate(club.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          marginBottom: 8,
                          minHeight: 44,
                          borderRadius: ui.radius.md,
                          backgroundColor: ui.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: ui.colors.border,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
                            {club.name}
                          </Text>
                          {(club.zone || club.city) ? (
                            <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                              {club.zone || club.city}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="checkmark-circle-outline" size={20} color={ui.colors.primary} />
                      </PressableScale>
                    ))}
                    <PrimaryButton
                      label="Explorar todos los clubs"
                      onPress={() => router.push('/(tabs)/clubs' as any)}
                      variant="ghost"
                      fullWidth
                      size="sm"
                      style={{ marginTop: 4, backgroundColor: ui.colors.surface }}
                    />
                  </>
                )}
              </AppCard>

              <AppCard onPress={playerLevelCategory ? openCategoryRanking : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Ranking por categoría</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                      {playerLevelCategory
                        ? `${playerLevelCategory} · ${featuredCircuit?.name || 'Circuito activo'}`
                        : 'Tu categoría'}
                    </Text>
                  </View>
                  <Ionicons name="trophy-outline" size={22} color={ui.colors.accent} />
                </View>
                {playerLevelCategory ? (
                  <>
                    <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 10 }}>
                      {myCategoryEntry
                        ? `Estás #${myCategoryEntry.position ?? categoryRanking.indexOf(myCategoryEntry) + 1} en ${playerLevelCategory} con ${myCategoryEntry.points} pts.`
                        : featuredCircuit
                          ? `Así viene hoy tu categoría ${playerLevelCategory} en ${featuredCircuit.name}.`
                          : `Todavía no hay circuitos para seguir la categoría ${playerLevelCategory}.`}
                    </Text>
                    {topCategoryRanking.length > 0 ? (
                      topCategoryRanking.map((entry, index) => (
                        <PressableScale
                          key={entry.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver perfil de ${entry.playerName}`}
                          onPress={() => entry.playerId && router.push(`/player/${entry.playerId}` as any)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: 6,
                            minHeight: 44,
                          }}
                        >
                          <Text style={{ fontWeight: '700', color: ui.colors.primary, width: 28 }}>
                            #{entry.position ?? index + 1}
                          </Text>
                          <Text style={{ flex: 1, color: ui.colors.textPrimary }} numberOfLines={1}>
                            {entry.playerName}
                          </Text>
                          <Text style={{ color: ui.colors.textSecondary, fontWeight: '700' }}>{entry.points} pts</Text>
                        </PressableScale>
                      ))
                    ) : (
                      <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
                        Todavía no hay posiciones cargadas para esta categoría.
                      </Text>
                    )}
                    {featuredCircuit?.id ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: ui.colors.primary }}>Ver tabla completa</Text>
                        <Ionicons name="chevron-forward" size={14} color={ui.colors.primary} />
                      </View>
                    ) : (
                      <PrimaryButton
                        label="Ver circuitos disponibles"
                        onPress={() => router.push('/(tabs)/rankings' as any)}
                        variant="ghost"
                        fullWidth
                        size="sm"
                        style={{ marginTop: 8, backgroundColor: ui.colors.surface }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 13, color: ui.colors.textMuted, marginBottom: 12 }}>
                      Tu categoría se calcula con tu nivel. Jugá partidos competitivos para aparecer en el ranking.
                    </Text>
                    <PrimaryButton
                      label="Buscar partido"
                      onPress={() => router.push('/browse-open-matches' as any)}
                      variant="outline"
                      fullWidth
                      size="sm"
                    />
                  </>
                )}
              </AppCard>
            </View>
          </>
        )}

        {!isClubAccount && (
          <>
            {isPlayerAccount && !showMoreHome ? (
              <PrimaryButton
                label="Explorar comunidad y torneos"
                onPress={() => setShowMoreHome(true)}
                variant="outline"
                fullWidth
                style={{ marginBottom: ui.spacing.lg }}
              />
            ) : null}

            {(!isPlayerAccount || showMoreHome) && (
              <>
                {isPlayerAccount ? (
                  <>
                    <SectionHeader
                      title="Más partidos abiertos"
                      subtitle={`${communityOpenMatches.length} partidos abiertos`}
                      action={
                        <PressableScale onPress={() => router.push('/(tabs)/matches' as any)} accessibilityRole="button" accessibilityLabel="Ver todos los partidos">
                          <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>Ver todos</Text>
                        </PressableScale>
                      }
                    />
                    {communityOpenMatches.length === 0 ? (
                      <EmptyState
                        icon={<Ionicons name="people-outline" size={28} color={ui.colors.textMuted} />}
                        title="Sin partidos en comunidad"
                        description="No hay otros partidos abiertos fuera de tu categoría."
                      />
                    ) : (
                      communityOpenMatches.slice(0, 3).map((match) => (
                        <AppCard key={match.id} onPress={() => router.push(`/match/${match.id}` as any)}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }} numberOfLines={1}>
                                {match.title}
                              </Text>
                              <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>{match.club?.name}</Text>
                            </View>
                            <StatusPill status={match.status} />
                          </View>
                          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                              {formatShortDate(match.date)} · {formatPlayPeriodLabel(match.date, match.endsAt)}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row' }}>
                              {match.players.slice(0, 4).map((p, i) => (
                                <Avatar key={p.id} name={p.name} size="sm" style={{ marginLeft: i > 0 ? -8 : 0 }} borderColor={ui.colors.card} />
                              ))}
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>
                              {match.joinedCount}/{match.neededPlayers}
                            </Text>
                          </View>
                        </AppCard>
                      ))
                    )}

                    <SectionHeader
                      title="Jugadores cerca"
                      subtitle={
                        usingGeoLocation
                          ? 'A menos de 30 km de vos'
                          : locationReady
                            ? 'Por zona · activá ubicación para ver distancia'
                            : 'Conectá y jugá'
                      }
                    />
                    {loadingNearby && players.length === 0 ? (
                      <SkeletonCard style={{ marginBottom: ui.spacing.lg }} />
                    ) : players.length === 0 ? (
                      <EmptyState
                        icon={<Ionicons name="navigate-outline" size={28} color={ui.colors.textMuted} />}
                        title="Nadie cerca todavía"
                        description={
                          usingGeoLocation
                            ? 'No hay jugadores con ubicación registrada cerca tuyo todavía.'
                            : 'Activá la ubicación o completá tu zona en el perfil para ver jugadores cercanos.'
                        }
                        action={
                          !usingGeoLocation ? (
                            <PrimaryButton
                              label="Activar ubicación"
                              onPress={async () => {
                                const coords = await requestPlayerCoordinates({
                                  withLabel: true,
                                  showAlerts: true,
                                });
                                if (!coords) return;
                                setPlayerCoords({ lat: coords.latitude, lng: coords.longitude });
                                setUsingGeoLocation(true);
                                await syncPlayerCoordinates(coords).catch(() => undefined);
                                refetchNearby();
                              }}
                              size="sm"
                            />
                          ) : undefined
                        }
                      />
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: ui.spacing.lg }}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {players.map((player) => {
                            const distanceLabel = formatDistanceKm(player.distanceKm);
                            return (
                              <AppCard
                                key={player.id}
                                onPress={() => router.push(`/player/${player.id}` as any)}
                                style={{ width: 120, marginBottom: 0 }}
                                padding="sm"
                              >
                                <Avatar name={player.name} photo={player.photo_url} size="lg" style={{ alignSelf: 'center', marginBottom: 8 }} />
                                <Text style={{ fontWeight: '700', fontSize: 13, color: ui.colors.textPrimary, textAlign: 'center' }} numberOfLines={1}>
                                  {player.nickname || player.name.split(' ')[0]}
                                </Text>
                                <Text style={{ fontSize: 11, color: ui.colors.textSecondary, textAlign: 'center', marginTop: 4 }} numberOfLines={1}>
                                  {distanceLabel || player.zone || player.city || 'Cerca'}
                                </Text>
                              </AppCard>
                            );
                          })}
                        </View>
                      </ScrollView>
                    )}
                  </>
                ) : (
                  <>
                    <SectionHeader
                      title="Buscar clubes"
                      subtitle={clubSearch.trim() ? `${filteredHomeClubs.length} resultados` : `${homeClubs?.length ?? 0} disponibles`}
                      action={
                        <PressableScale onPress={() => router.push('/(tabs)/clubs' as any)} accessibilityRole="button" accessibilityLabel="Ver todos los clubes">
                          <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>Ver todos</Text>
                        </PressableScale>
                      }
                    />
                    <InputField
                      label="Nombre, ciudad o zona"
                      value={clubSearch}
                      onChangeText={setClubSearch}
                      placeholder="Ej. Palermo, Norte, Pádel Club..."
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {loadingHomeClubs && filteredHomeClubs.length === 0 ? (
                      <SkeletonCard style={{ marginBottom: ui.spacing.lg }} />
                    ) : filteredHomeClubs.length === 0 ? (
                      <EmptyState
                        icon={<Ionicons name="business-outline" size={28} color={ui.colors.textMuted} />}
                        title={clubSearch.trim() ? 'Sin resultados' : 'Sin clubes'}
                        description={
                          clubSearch.trim()
                            ? 'Probá con otro nombre, ciudad o zona.'
                            : 'Todavía no hay clubes registrados.'
                        }
                      />
                    ) : (
                      filteredHomeClubs.map((club) => (
                        <AppCard key={club.id} onPress={() => router.push(`/club/${club.id}` as any)}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Avatar name={club.name} photo={club.logo_url} size="md" style={{ marginBottom: 0 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{club.name}</Text>
                              {(club.city || club.zone) ? (
                                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                                  {[club.zone, club.city].filter(Boolean).join(' · ')}
                                </Text>
                              ) : null}
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                          </View>
                        </AppCard>
                      ))
                    )}
                  </>
                )}

                <SectionHeader
                  title="Torneos disponibles"
                  action={
                    <PressableScale onPress={() => router.push('/tournaments' as any)} accessibilityRole="button" accessibilityLabel="Ver todos los torneos">
                      <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>Ver todos</Text>
                    </PressableScale>
                  }
                />
                {upcomingTournaments.length === 0 ? (
                  <EmptyState
                    icon={<Ionicons name="trophy-outline" size={28} color={ui.colors.textMuted} />}
                    title="Sin torneos"
                    description="No hay torneos publicados."
                  />
                ) : (
                  upcomingTournaments.map((t) => (
                    <AppCard key={t.id} onPress={() => router.push(`/tournament/${t.id}` as any)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: ui.colors.warningSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="trophy" size={24} color={ui.colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{t.name}</Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                            Cat. {t.category || '—'}
                            {t.startDate ? ` · ${formatShortDate(t.startDate)}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                      </View>
                    </AppCard>
                  ))
                )}

                {isPlayerAccount && (
                  <>
                    <SectionHeader title="Comunidad" />
                    <AppCard style={{ marginBottom: ui.spacing.lg }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel="Ranking general"
                          onPress={() => router.push('/ranking-general' as any)}
                          style={{
                            flex: 1,
                            padding: 14,
                            borderRadius: ui.radius.md,
                            backgroundColor: ui.colors.surfaceAlt,
                            borderWidth: 1,
                            borderColor: ui.colors.border,
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              backgroundColor: ui.colors.primarySoft,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 10,
                            }}
                          >
                            <Ionicons name="podium" size={22} color={ui.colors.primary} />
                          </View>
                          <Text style={{ fontWeight: '800', color: ui.colors.textPrimary, fontSize: 14 }}>Ranking general</Text>
                          <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 4 }}>
                            Por categoría y género
                          </Text>
                        </PressableScale>

                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel="Últimos partidos"
                          onPress={() => router.push('/recent-matches' as any)}
                          style={{
                            flex: 1,
                            padding: 14,
                            borderRadius: ui.radius.md,
                            backgroundColor: ui.colors.surfaceAlt,
                            borderWidth: 1,
                            borderColor: ui.colors.border,
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              backgroundColor: ui.colors.warningSoft,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 10,
                            }}
                          >
                            <Ionicons name="tennisball" size={22} color={ui.colors.accent} />
                          </View>
                          <Text style={{ fontWeight: '800', color: ui.colors.textPrimary, fontSize: 14 }}>Últimos partidos</Text>
                          <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 4 }}>
                            Resultados recientes
                          </Text>
                        </PressableScale>
                      </View>
                    </AppCard>
                  </>
                )}

                {isPlayerAccount && upcomingMatches.length > 0 && (
                  <>
                    <SectionHeader title="Próximos partidos" subtitle={`${upcomingMatches.length} agendados`} />
                    {upcomingMatches.slice(0, 5).map((match) => (
                      <AppCard key={match.id} onPress={() => router.push(`/match/${match.id}` as any)}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{formatShortDate(match.date)}</Text>
                          <StatusPill status={match.status} />
                        </View>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                          {formatTime(match.date)}
                          {match.club?.name ? ` · ${match.club.name}` : ''}
                        </Text>
                      </AppCard>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
