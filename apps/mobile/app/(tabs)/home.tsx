import { ScrollView, Text, RefreshControl, View, Alert, Image, useWindowDimensions, FlatList } from 'react-native';
import { TabScrollView } from '@/components/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { isClub, canOrganizeEvents, isPlayer } from '@/lib/roles';
import { api } from '@/lib/api';
import { mapMatch, mapPlayer, mapTournament, safeMapCircuit } from '@/lib/mappers';
import { useCircuitsEnabled } from '@/lib/features';
import type { Circuit, CircuitRankingEntry, Match, Player, Tournament } from '@/lib/types';
import { formatShortDate, formatTime } from '@/lib/format';
import {
  matchOverlapsCategory,
  playerSkillFitsMatchRange,
  resolveSkillScore,
} from '@/lib/skill';
import { playerFitsTournamentCategory } from '@/lib/tournament/types';
import { formatDistanceKm, requestPlayerCoordinates, syncPlayerCoordinates } from '@/lib/geolocation';
import { invalidateRedeemablePoints, useRedeemablePoints } from '@/lib/shop/redeemable-points';
import { ui, fontFamily } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import { ClubProfilePanel } from '@/components/club/ClubProfilePanel';
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
  SearchableSelect,
  OpenMatchCard,
  isViewerInMatch,
  TournamentCard,
  ShopPromoBanner,
  ProfilePhotoViewer,
} from '@/components/x4match';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';

const HOME_TOUR_STEPS: TourStep[] = [
  {
    target: 'home.header',
    title: 'Tu tarjeta de jugador',
    description:
      'Tu nombre y tu nivel actual (puntaje y categoría). Se actualiza cada vez que se confirma el resultado de un partido competitivo.',
  },
  {
    target: 'home.notifications',
    title: 'Notificaciones',
    description:
      'Invitaciones a partidos, solicitudes para unirse, resultados para confirmar y novedades. El número indica cuántas tenés sin leer.',
  },
  {
    target: 'home.playNow',
    title: 'Jugar ahora',
    description: 'El atajo más rápido: te muestra los partidos abiertos de tu categoría cerca tuyo para que te sumes.',
  },
  {
    target: 'home.shop',
    title: 'Tienda',
    description: 'Productos y promociones de los clubes y marcas asociadas.',
  },
  {
    target: 'home.openMatches',
    title: 'Partidos abiertos',
    description:
      'Partidos que buscan jugadores. Deslizá para ver más y tocá uno para ver el detalle y unirte. "Ver todos" abre el buscador completo.',
  },
  {
    target: 'home.nearby',
    title: 'Jugadores cerca',
    description:
      'Jugadores a menos de 30 km. Tocá uno para ver su perfil, seguirlo o escribirle. Necesita tu ubicación activada.',
  },
  {
    target: 'home.tournaments',
    title: 'Torneos disponibles',
    description: 'Torneos con inscripción abierta. Entrá a uno para ver categorías, fechas e inscribirte con tu pareja.',
  },
  {
    target: 'home.community',
    title: 'Comunidad',
    description:
      '"Ranking general" muestra a los mejores jugadores por categoría y género. "Últimos partidos" muestra los resultados recientes.',
  },
  {
    target: 'home.ranking',
    title: 'Ranking de tu club',
    description:
      'Tu posición en el ranking interno de tu club principal. Sumás puntos jugando partidos competitivos. "Tabla completa" muestra a todos.',
  },
  {
    target: 'tab.home',
    fixed: true,
    title: 'Inicio',
    description: 'Volvé a esta pantalla desde cualquier lugar de la app.',
  },
  {
    target: 'tab.matches',
    fixed: true,
    title: 'Partidos',
    description: 'Tus próximos partidos, tu historial, torneos y circuitos. Desde ahí cargás y confirmás resultados.',
  },
  {
    target: 'tab.search',
    fixed: true,
    title: 'Jugar',
    description: 'Creá un partido abierto, buscá partidos o usá el matchmaking automático. También buscás jugadores y clubes.',
  },
  {
    target: 'tab.messages',
    fixed: true,
    title: 'Mensajes',
    description: 'Chats directos con otros jugadores y el chat grupal de cada partido.',
  },
  {
    target: 'tab.profile',
    fixed: true,
    title: 'Perfil',
    description: 'Tus datos, nivel, estadísticas, club principal y la configuración de tu cuenta.',
  },
];

const HERO_IMAGE = require('../../assets/cancha.png');
const HEADER_STRIPES = require('../../assets/figma/profile/tiras.png');
const ICON_TROFEO = require('../../assets/figma/shared/trofeo.png');
const ICON_NOTE = require('../../assets/figma/shared/note.png');
const ICON_CLUB = require('../../assets/figma/shared/edificio.png');
const LIME = '#D7FF00';

function LocationPinIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 2.5C7.511 2.5 5.502 4.509 5.502 6.998C5.502 10.266 9 14.993 10 16.992C11 14.993 14.498 10.266 14.498 6.998C14.498 4.509 12.489 2.5 10 2.5Z"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const RANK_BADGE = ['#4D482F', '#4D482F', '#473C35'] as const;
const RANK_BADGE_TEXT = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;

function formatHomeMatchWhen(date: string) {
  return `${formatShortDate(date)}, ${formatTime(date)}`;
}

const TOURNAMENT_CAROUSEL_GAP = 12;

function TournamentCarousel({
  tournaments,
  cardWidth,
  onPressTournament,
}: {
  tournaments: Tournament[];
  cardWidth: number;
  onPressTournament: (id: string) => void;
}) {
  const interval = cardWidth + TOURNAMENT_CAROUSEL_GAP;
  return (
    <FlatList
      horizontal
      data={tournaments}
      keyExtractor={(t) => t.id}
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      decelerationRate="fast"
      snapToInterval={interval}
      snapToAlignment="start"
      disableIntervalMomentum
      getItemLayout={(_, index) => ({
        length: interval,
        offset: interval * index,
        index,
      })}
      style={{ marginBottom: ui.spacing.lg }}
      contentContainerStyle={{ paddingRight: 16, alignItems: 'flex-start' }}
      renderItem={({ item: t, index }) => (
        <View
          style={{
            width: cardWidth,
            marginRight: index === tournaments.length - 1 ? 0 : TOURNAMENT_CAROUSEL_GAP,
          }}
        >
          <TournamentCard
            tournament={t}
            width={cardWidth}
            variant="compact"
            onPress={() => onPressTournament(t.id)}
          />
        </View>
      )}
    />
  );
}

function GlassEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <AppCard style={{ marginBottom: ui.spacing.lg }} padding="lg">
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        {icon}
        <Text
          style={{
            fontSize: 16,
            fontFamily: ui.typography.h3.fontFamily,
            color: ui.colors.textPrimary,
            textAlign: 'center',
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: ui.colors.textSecondary,
            textAlign: 'center',
            lineHeight: 18,
            maxWidth: 280,
            marginBottom: action ? 16 : 0,
          }}
        >
          {description}
        </Text>
        {action}
      </View>
    </AppCard>
  );
}

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

type ClubOption = { id: string; name: string; city?: string; location?: string; logo_url?: string };

export default function HomeScreen() {
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const { user, token, updateUser, logout } = useAuth();
  const isClubAccount = isClub(user?.role);
  const isEventOrganizerAccount = canOrganizeEvents(user?.role);
  const isPlayerAccount = isPlayer(user?.role);
  const authed = Boolean(token);
  const scrollRef = useRef<ScrollView>(null);
  useScreenTour('home', HOME_TOUR_STEPS, { enabled: isPlayerAccount, scrollRef });
  /** Ancho de card en carrusel: una card dominante + peek de la siguiente. */
  const tournamentCarouselCardWidth = Math.round(Math.min(288, windowWidth - 72));

  const handleClubLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const { data: playerProfile, refetch: refetchPlayerProfile } = useQuery({
    queryKey: ['home-player-profile'],
    queryFn: async () => {
      const res = await api.get('/users/profile');
      return res.data as {
        mainClubId?: string;
        mainClub?: { id: string; name: string; city?: string; location?: string };
        levelCategory?: string;
        categoryStatus?: 'provisional' | 'confirmed';
        declaredCategory?: string;
      };
    },
    enabled: authed && isPlayerAccount,
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
  const insets = useSafeAreaInsets();
  const [clubSearch, setClubSearch] = useState('');
  const [playerCoords, setPlayerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [usingGeoLocation, setUsingGeoLocation] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const profilePhoto = user?.photo?.trim() || null;

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
    enabled: authed && !isClubAccount,
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
    enabled: authed && isPlayerAccount && locationReady,
  });

  const { data: homeClubs, refetch: refetchHomeClubs, isLoading: loadingHomeClubs } = useQuery({
    queryKey: ['clubs-home-search'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data as ClubOption[];
    },
    enabled: authed && isEventOrganizerAccount && !isClubAccount,
  });

  const { data: tournaments, refetch: refetchTournaments } = useQuery({
    queryKey: ['tournaments-home'],
    queryFn: async () => {
      const res = await api.get('/tournaments');
      return res.data;
    },
    enabled: authed && !isClubAccount,
  });

  const { data: unreadNotifications, refetch: refetchUnreadNotifications } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return Number(res.data?.count ?? 0);
    },
    enabled: authed && isPlayerAccount,
  });

  useFocusEffect(
    useCallback(() => {
      if (authed && isPlayerAccount) refetchUnreadNotifications();
    }, [authed, isPlayerAccount, refetchUnreadNotifications]),
  );

  const { data: playerMe, refetch: refetchPlayerMe } = useQuery({
    queryKey: ['home-player-me'],
    queryFn: async () => {
      const res = await api.get('/players/me');
      return res.data;
    },
    enabled: authed && isPlayerAccount,
  });

  const { data: playerMainClubFetched, refetch: refetchPlayerMainClub } = useQuery({
    queryKey: ['player-home-main-club', playerMainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${playerMainClubId}`);
      return res.data as ClubOption;
    },
    enabled: authed && isPlayerAccount && !!playerMainClubId,
  });

  const playerMainClub = playerProfile?.mainClub ?? playerMainClubFetched ?? null;

  const { data: clubOptions, refetch: refetchClubOptions } = useQuery({
    queryKey: ['clubs-home-picker'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data as ClubOption[];
    },
    enabled: authed && isPlayerAccount,
  });

  const { data: playerClubLeaderboard, refetch: refetchPlayerClubLeaderboard } = useQuery({
    queryKey: ['player-home-club-leaderboard', playerMainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${playerMainClubId}/leaderboard`);
      return res.data as ClubLeaderboardEntry[];
    },
    enabled: authed && isPlayerAccount && !!playerMainClubId,
  });

  const { refetch: refetchPlayerClubPoints } = useRedeemablePoints(
    playerMainClubId,
    isPlayerAccount,
  );

  const { data: circuits, refetch: refetchCircuits } = useQuery({
    queryKey: ['circuits-home-player'],
    queryFn: async () => {
      const res = await api.get('/circuits');
      return res.data;
    },
    enabled: circuitsEnabled && authed && isPlayerAccount,
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs-home'],
    queryFn: async () => {
      const res = await api.get('/clubs/mine');
      return res.data;
    },
    enabled: authed && isClubAccount,
  });

  const mainClubId = isClubAccount ? clubs?.[0]?.id : undefined;

  const { data: clubDashboard, refetch: refetchDashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['club-dashboard-home', mainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${mainClubId}/dashboard`);
      return res.data as ClubDashboard;
    },
    enabled: authed && isClubAccount && !!mainClubId,
  });

  const { data: clubCourtSlots, refetch: refetchClubSlots, isLoading: loadingClubSlots } = useQuery({
    queryKey: ['club-home-court-slots', mainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${mainClubId}/court-slots`);
      return res.data as CourtSlotRow[];
    },
    enabled: authed && isClubAccount && !!mainClubId,
  });

  const { data: clubMatchesRaw, refetch: refetchClubMatches, isLoading: loadingClubMatches } = useQuery({
    queryKey: ['club-home-matches', mainClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${mainClubId}/matches`);
      return res.data;
    },
    enabled: authed && isClubAccount && !!mainClubId,
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
    enabled: authed && isPlayerAccount && !!featuredCircuit?.id,
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
    router.push('/clubs' as any);
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
      refetchUnreadNotifications();
      refetchPlayerMe();
      refetchPlayerProfile();
      refetchPlayerMainClub();
      refetchPlayerClubLeaderboard();
      refetchPlayerClubPoints();
      if (circuitsEnabled) refetchCircuits();
      refetchClubOptions();
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
    refetchNearby,
    refetchUnreadNotifications,
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

  const homeOpenMatches = useMemo(() => {
    const available = openMatches.filter(
      (match) => match.status === 'OPEN' && match.joinedCount < match.neededPlayers,
    );
    if (!isPlayerAccount) return available;

    // Primero los que podés sumarte; después los tuyos / con solicitud.
    const joinable: Match[] = [];
    const mine: Match[] = [];
    for (const match of available) {
      if (isViewerInMatch(match, user?.id) || match.viewerJoinStatus === 'REQUESTED') {
        mine.push(match);
      } else {
        joinable.push(match);
      }
    }
    return [...joinable, ...mine];
  }, [isPlayerAccount, openMatches, user?.id]);

  const filteredHomeClubs = useMemo(() => {
    const q = clubSearch.trim().toLowerCase();
    const list = homeClubs || [];
    if (!q) return list.slice(0, 6);
    return list
      .filter((club) => {
        const haystack = [club.name, club.city, club.location].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [clubSearch, homeClubs]);

  const clubSelectOptions = useMemo(() => {
    const byId = new Map<string, ClubOption>();
    for (const club of clubOptions || []) {
      byId.set(club.id, club);
    }
    if (playerMainClub?.id && !byId.has(playerMainClub.id)) {
      byId.set(playerMainClub.id, {
        id: playerMainClub.id,
        name: playerMainClub.name,
        city: playerMainClub.city,
        location: playerMainClub.location,
      });
    }
    return Array.from(byId.values()).map((club) => ({
      value: club.id,
      label: club.name,
      subtitle: [club.city, club.location].filter(Boolean).join(' · ') || undefined,
    }));
  }, [clubOptions, playerMainClub]);

  const players: Player[] = (nearbyPlayers || []).slice(0, 5).map(mapPlayer);
  const tournamentList: Tournament[] = (tournaments || []).map(mapTournament);
  const playableTournaments = isPlayerAccount
    ? tournamentList.filter((t) => playerFitsTournamentCategory(playerLevelCategory, t.category))
    : tournamentList;
  const upcomingTournaments = playableTournaments
    .filter((t) => t.status === 'OPEN_REGISTRATION')
    .slice(0, 8);

  const clubHomeLoading =
    isClubAccount && (loadingDashboard || loadingClubSlots || loadingClubMatches);

  const openCourtSlots = (clubCourtSlots || []).filter(
    (slot) => slot.status === 'OPEN' && slot.slot_date >= todayDateKey(),
  );
  const clubMatches: Match[] = (clubMatchesRaw || []).map(mapMatch);
  const clubOpenMatches = clubMatches.filter((m) => ['OPEN', 'FULL'].includes(m.status));
  const clubUpcomingMatches = clubMatches.filter((m) => ['CONFIRMED', 'IN_PROGRESS'].includes(m.status));
  const mainClubName = clubs?.[0]?.name;
  const firstName = (user?.name || 'Jugador').split(' ')[0];
  const skillLabel = `Skill: ${playerSkillScore} · ${playerLevelCategory || playerDeclaredCategory || '—'}`;
  const activeMatchesToday = openMatches.filter((m) => formatShortDate(m.date) === 'Hoy').length;
  const heroActiveCount = activeMatchesToday || openMatches.length;

  const rankingRows =
    (playerClubLeaderboard || []).length > 0
      ? (playerClubLeaderboard || []).slice(0, 3).map((entry) => ({
        id: entry.user_id,
        name: entry.nickname || entry.name,
        category: playerLevelCategory ? `Cat ${playerLevelCategory}` : undefined,
        points: entry.points,
        photo: entry.photo_url,
        rank: Number(entry.rank) || 0,
      }))
      : topCategoryRanking.map((entry, index) => ({
        id: entry.playerId || entry.id,
        name: entry.playerName,
        category: entry.categoryLabel
          ? `Cat ${entry.categoryLabel}`
          : playerLevelCategory
            ? `Cat ${playerLevelCategory}`
            : undefined,
        points: entry.points,
        photo: undefined as string | undefined,
        rank: entry.position ?? index + 1,
      }));

  const activateLocation = async () => {
    const coords = await requestPlayerCoordinates({
      withLabel: true,
      showAlerts: true,
    });
    if (!coords) return;
    setPlayerCoords({ lat: coords.latitude, lng: coords.longitude });
    setUsingGeoLocation(true);
    await syncPlayerCoordinates(coords).catch(() => undefined);
    refetchNearby();
  };

  const openRankingTable = () => {
    if (playerMainClubId) {
      openClubRanking();
      return;
    }
    openCategoryRanking();
  };

  if (isClubAccount) {
    return (
      <Screen>
        <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
          <ClubProfilePanel onLogout={handleClubLogout} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {!isPlayerAccount ? <AppHeader showUserGreeting showNotifications /> : null}
      <TabScrollView
        ref={scrollRef}
        contentContainerStyle={{
          ...tabScreenPadding,
          ...(isPlayerAccount ? { paddingTop: insets.top + 8 } : null),
        }}
        refreshControl={
          <RefreshControl
            refreshing={isClubAccount ? !!clubHomeLoading : feedLoading}
            onRefresh={onRefresh}
            tintColor={ui.colors.primary}
          />
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
        ) : isPlayerAccount ? (
          <>
            {/* <SearchableSelect
              label="Club principal"
              placeholder="Elegí tu club"
              searchPlaceholder="Buscar club…"
              emptyMessage="No se encontraron clubs"
              value={playerMainClubId ?? null}
              options={clubSelectOptions}
              disabled={setMainClubMutation.isPending}
              onChange={(clubId) => {
                if (clubId === playerMainClubId) return;
                setMainClubMutation.mutate(clubId);
              }}
              renderTrigger={({ open, selected, placeholder }) => (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Seleccionar club principal"
                  onPress={open}
                  disabled={setMainClubMutation.isPending}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    alignSelf: 'stretch',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    marginBottom: ui.spacing.md,
                    borderRadius: ui.radius.pill,
                    backgroundColor: ui.colors.glass,
                    borderWidth: 1,
                    borderColor: ui.colors.border,
                    opacity: setMainClubMutation.isPending ? 0.7 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: ui.colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="home" size={14} color={ui.colors.primary} />
                  </View>
                  <Text style={{ flex: 1, color: ui.colors.textPrimary, fontSize: 14 }} numberOfLines={1}>
                    Padel Club:{' '}
                    <Text style={{ fontFamily: ui.typography.h3.fontFamily, fontWeight: '700' }}>
                      {selected?.label || placeholder}
                    </Text>
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={ui.colors.textSecondary} />
                </PressableScale>
              )}
            /> */}

            <FadeInUp index={0}>
              <TourTarget id="home.header" style={{ marginBottom: ui.spacing.md }}>
              <View
                style={{
                  borderRadius: 22,
                  overflow: 'hidden',
                  backgroundColor: '#000000',
                  minHeight: 118,
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    right: -20,
                    top: -24,
                    bottom: -24,
                    width: 210,
                  }}
                >
                  <Image
                    source={HEADER_STRIPES}
                    style={{ width: 210, height: 170 }}
                    resizeMode="cover"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                </View>

                <TourTarget
                  id="home.notifications"
                  style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}
                >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadNotifications
                      ? `Notificaciones, ${unreadNotifications} sin leer`
                      : 'Notificaciones'
                  }
                  onPress={() => router.push('/notifications' as any)}
                  hitSlop={8}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.14)',
                  }}
                >
                  <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                  {unreadNotifications ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        borderRadius: 9,
                        backgroundColor: LIME,
                        borderWidth: 2,
                        borderColor: '#000000',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          lineHeight: 12,
                          color: '#000000',
                          fontFamily: fontFamily.bold,
                          fontWeight: '700',
                        }}
                      >
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </Text>
                    </View>
                  ) : null}
                </PressableScale>
                </TourTarget>

                <View
                  style={{
                    paddingLeft: 21,
                    paddingRight: 60,
                    paddingVertical: 23,
                    minHeight: 118,
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <PressableScale
                      onPress={() => {
                        if (profilePhoto) {
                          setShowPhotoViewer(true);
                          return;
                        }
                        router.push('/(tabs)/profile' as any);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        profilePhoto ? 'Ver foto de perfil' : 'Ir a perfil para agregar foto'
                      }
                      style={{ marginRight: 12 }}
                    >
                      <Avatar
                        name={user?.name || 'Jugador'}
                        photo={profilePhoto || undefined}
                        size="xxl"
                        borderColor="#FFFFFF"
                        style={
                          {
                            width: 72,
                            height: 72,
                            borderRadius: 36,
                            borderWidth: 1,
                            backgroundColor: 'rgba(30,30,36,0.8)',
                          } as any
                        }
                      />
                    </PressableScale>
                    <View style={{ flex: 1, marginRight: 8, gap: 6 }}>
                      <Text
                        style={{
                          fontSize: 24,
                          lineHeight: 36,
                          letterSpacing: -0.48,
                          fontFamily: ui.typography.h2.fontFamily,
                          color: '#FFFFFF',
                        }}
                        numberOfLines={1}
                      >
                        Hola, {firstName}
                      </Text>
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: ui.radius.pill,
                          backgroundColor: '#000000',
                          borderWidth: 1,
                          borderColor: LIME,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            lineHeight: 16.5,
                            color: '#FFFFFF',
                            fontFamily: fontFamily.bold,
                            fontWeight: '700',
                          }}
                        >
                          {skillLabel}
                        </Text>
                      </View>
                    </View>
                    {/*  <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={
                        usingGeoLocation ? 'Ubicación activa' : 'Activar ubicación'
                      }
                      onPress={activateLocation}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LinearGradient
                        colors={[LIME, '#C6EF00']}
                        start={{ x: 0.15, y: 0 }}
                        end={{ x: 0.9, y: 1 }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                        }}
                      />
                      <LocationPinIcon size={20} />
                    </PressableScale> */}
                  </View>
                </View>
              </View>
              </TourTarget>
            </FadeInUp>

            <FadeInUp index={1}>
              <TourTarget id="home.playNow" style={{ marginBottom: ui.spacing.lg }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Jugar ahora"
                onPress={() => router.push('/browse-open-matches' as any)}
                style={{
                  borderRadius: ui.radius.xl,
                  backgroundColor: ui.colors.surface0,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.5,
                  shadowRadius: 40,
                  elevation: 16,
                }}
              >
                <View style={{ height: 200, borderRadius: ui.radius.xl, overflow: 'hidden' }}>
                  <Image source={HERO_IMAGE} style={{ position: 'absolute', width: '100%', height: '100%' }} />
                  <LinearGradient
                    colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                  />
                  <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: 34, lineHeight: 38, color: '#fff' }}>
                        Jugár <Text style={{ color: ui.colors.primary }}>ahora</Text>
                      </Text>
                      <Text
                        style={{
                          marginTop: 8,
                          color: 'rgba(255,255,255,0.88)',
                          fontSize: 14,
                          lineHeight: 20,
                          maxWidth: 240,
                        }}
                      >
                        Encontrá rivales y reserva pistas de forma automática.
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ui.colors.primary }} />
                        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                          {heroActiveCount} partido{heroActiveCount === 1 ? '' : 's'} activo{heroActiveCount === 1 ? '' : 's'} hoy
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: ui.colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="arrow-forward" size={22} color={ui.colors.onPrimary} />
                      </View>
                    </View>
                  </View>
                </View>
              </PressableScale>
              </TourTarget>
            </FadeInUp>

            <TourTarget id="home.shop" style={{ marginBottom: ui.spacing.lg, marginTop: 8 }}>
              <ShopPromoBanner onPress={() => router.push('/shop' as any)} />
            </TourTarget>

            <TourTarget id="home.openMatches" style={{ marginTop: ui.spacing.lg, marginBottom: ui.spacing.md }}>
            <SectionHeader
              title="Más partidos abiertos"
              style={{ marginBottom: 0 }}
              action={
                <PressableScale
                  onPress={() => router.push('/browse-open-matches' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Ver todos los partidos"
                >
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>
                    Ver todos
                  </Text>
                </PressableScale>
              }
            />
            </TourTarget>
            {feedLoading && homeOpenMatches.length === 0 ? (
              <SkeletonCard style={{ marginBottom: ui.spacing.lg }} />
            ) : homeOpenMatches.length === 0 ? (
              <GlassEmpty
                icon={<Ionicons name="add" size={24} color={ui.colors.primary} />}
                title="Sin partidos abiertos"
                description="Creá uno o volvé más tarde para sumarte"
                action={
                  <PrimaryButton
                    style={{ marginTop: ui.spacing.lg }}
                    label="Crear partido abierto"
                    onPress={() => router.push('/create-open-match' as any)}
                    size="sm"
                    icon={<Ionicons name="add-circle-outline" size={16} color={ui.colors.onPrimary} />}
                  />
                }
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 8, marginBottom: ui.spacing.lg }}
              >
                {homeOpenMatches.slice(0, 8).map((match) => {
                  const requiresApproval =
                    playerCategoryStatus === 'provisional' && playerDeclaredCategory
                      ? !matchOverlapsCategory(match.levelMin, match.levelMax, playerDeclaredCategory)
                      : !playerSkillFitsMatchRange(playerSkillScore, match.levelMin, match.levelMax);
                  return (
                    <OpenMatchCard
                      key={match.id}
                      match={match}
                      viewerUserId={user?.id}
                      onPress={() => router.push(`/match/${match.id}` as any)}
                      ctaLabel={requiresApproval ? 'Solicitar unirse' : 'Unirse a Partido'}
                    />
                  );
                })}
              </ScrollView>
            )}

            <TourTarget id="home.nearby" style={{ marginBottom: ui.spacing.md }}>
            <SectionHeader
              title="Jugadores cerca"
              style={{ marginBottom: 0 }}
              subtitle={
                usingGeoLocation
                  ? 'A menos de 30 km de vos'
                  : locationReady
                    ? 'Activa la ubicación para ver distancia'
                    : 'Conectá y jugá'
              }
            />
            </TourTarget>
            {loadingNearby && players.length === 0 ? (
              <SkeletonCard style={{ marginBottom: ui.spacing.lg }} />
            ) : players.length === 0 ? (
              <GlassEmpty
                icon={<Ionicons name="location" size={22} color={ui.colors.primary} />}
                title={usingGeoLocation ? 'Nadie cerca todavía' : 'Activá tu ubicación'}
                description={
                  usingGeoLocation
                    ? 'No encontramos jugadores a menos de 30 km por ahora. Probá más tarde.'
                    : 'Necesitamos tu ubicación para mostrarte jugadores cerca de vos.'
                }
                action={
                  !usingGeoLocation ? (
                    <PrimaryButton label="Activar ubicación" onPress={activateLocation} size="md" />
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
                        <Avatar name={player.name} photo={player.photo_url} size="lg" style={{ alignSelf: 'center', marginBottom: 8 } as any} />
                        <Text
                          style={{ fontWeight: '700', fontSize: 13, color: ui.colors.textPrimary, textAlign: 'center' }}
                          numberOfLines={1}
                        >
                          {player.nickname || player.name.split(' ')[0]}
                        </Text>

                      </AppCard>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            <TourTarget id="home.tournaments" style={{ marginBottom: ui.spacing.md }}>
            <SectionHeader
              title="Torneos disponibles"
              style={{ marginBottom: 0 }}
              action={
                <PressableScale
                  onPress={() => router.push('/tournaments' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Ver todos los torneos"
                >
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>
                    Ver todos
                  </Text>
                </PressableScale>
              }
            />
            </TourTarget>
            {upcomingTournaments.length === 0 ? (
              <GlassEmpty
                icon={
                  <Image
                    source={ICON_TROFEO}
                    style={{ width: 28, height: 28, marginBottom: 8 }}
                    resizeMode="contain"
                  />
                }
                title="Sin torneos"
                description="No hay torneos publicados"
              />
            ) : (
              <TournamentCarousel
                tournaments={upcomingTournaments}
                cardWidth={tournamentCarouselCardWidth}
                onPressTournament={(id) => router.push(`/tournament/${id}` as any)}
              />
            )}



            <SectionHeader title="Comunidad" />
            <TourTarget id="home.community" style={{ marginBottom: ui.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Ranking general"
                  onPress={() => router.push('/ranking-general' as any)}
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 14,
                    paddingHorizontal: 6,
                    borderRadius: ui.radius.lg,
                    backgroundColor: '#111115',
                    borderWidth: 1,
                    borderColor: ui.colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      //backgroundColor: ui.colors.primarySoft,
                      borderWidth: 1,
                      borderColor: ui.colors.primaryGlow,
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...ui.shadow.glow,
                    }}
                  >
                    <Ionicons name="star" size={18} color={ui.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: ui.colors.textPrimary, fontSize: 14 }} numberOfLines={1}>
                      Ranking general
                    </Text>
                    <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                      Por categoría y género
                    </Text>
                  </View>
                </PressableScale>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Últimos partidos"
                  onPress={() => router.push('/recent-matches' as any)}
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 14,
                    paddingHorizontal: 6,
                    borderRadius: ui.radius.lg,
                    backgroundColor: '#111115',
                    borderWidth: 1,
                    borderColor: ui.colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      //backgroundColor: ui.colors.primarySoft,
                      borderWidth: 1,
                      borderColor: '#D7FF0040',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...ui.shadow.glow,
                    }}
                  >
                    <Image
                      source={ICON_NOTE}
                      style={{ width: 16, height: 16 }}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: ui.colors.textPrimary, fontSize: 14 }} numberOfLines={1}>
                      Últimos partidos
                    </Text>
                    <Text style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                      Resultados recientes
                    </Text>
                  </View>
                </PressableScale>
              </View>
            </View>
            </TourTarget>

            <TourTarget id="home.ranking" style={{ marginBottom: ui.spacing.md }}>
            <SectionHeader
              title="Ranking"
              style={{ marginBottom: 0 }}
              action={
                <PressableScale onPress={openRankingTable} accessibilityRole="button" accessibilityLabel="Tabla completa">
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>
                    Tabla completa
                  </Text>
                </PressableScale>
              }
            />
            </TourTarget>
            {!playerMainClubId ? (
              <GlassEmpty
                icon={<Image
                  source={ICON_CLUB}
                  style={{ width: 22, height: 22, marginBottom: 8 }}
                  resizeMode="contain"
                />}
                title="Elegí tu club principal"
                description="Necesitás un club para ver el ranking interno y sumar puntos."
                action={
                  <PrimaryButton label="Explorar clubs" onPress={() => router.push('/clubs' as any)} size="sm" />
                }
              />
            ) : rankingRows.length === 0 ? (
              <GlassEmpty
                icon={<FontAwesome6 name="ranking-star" size={22} style={{ marginBottom: 8 }} color={ui.colors.primary} />}
                title="Sin ranking todavía"
                description="Jugá partidos en tu club para empezar a sumar puntos."
              />
            ) : (
              rankingRows.map((entry, index) => (
                <PressableScale
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver perfil de ${entry.name}`}
                  onPress={() => router.push(`/player/${entry.id}` as any)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    marginBottom: 10,
                    borderRadius: 24,
                    backgroundColor: '#141418BF',
                    borderWidth: 1,
                    borderColor: '#252B27',
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: RANK_BADGE[Math.min(index, 2)],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '800', color: RANK_BADGE_TEXT[Math.min(index, 2)] }}>
                      {entry.rank || index + 1}
                    </Text>
                  </View>
                  <Avatar name={entry.name} photo={entry.photo} size="md" style={{ borderRadius: 14 } as any} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: ui.colors.textPrimary,
                        fontWeight: '700',
                        fontSize: 15,
                      }}
                      numberOfLines={1}
                    >
                      {entry.name}
                    </Text>
                    {entry.category ? (
                      <Text
                        style={{
                          color: ui.colors.textSecondary,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {entry.category}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text
                      style={{
                        color: ui.colors.primary,
                        fontFamily: ui.typography.label.fontFamily,
                        fontSize: 18,
                        fontWeight: '800',
                      }}
                    >
                      {entry.points.toLocaleString('es-AR')}
                    </Text>
                    <Text
                      style={{
                        color: ui.colors.textSecondary,
                        fontSize: 12,
                        fontWeight: '500',
                      }}
                    >
                      PTS
                    </Text>
                  </View>
                </PressableScale>
              ))
            )}

          </>
        ) : (
          <>
            <SectionHeader
              title="Buscar clubes"
              subtitle={clubSearch.trim() ? `${filteredHomeClubs.length} resultados` : `${homeClubs?.length ?? 0} disponibles`}
              action={
                <PressableScale
                  onPress={() => router.push('/clubs' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Ver todos los clubes"
                >
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>
                    Ver todos
                  </Text>
                </PressableScale>
              }
            />
            <InputField
              label="Nombre o ciudad"
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
                    ? 'Probá con otro nombre o ciudad.'
                    : 'Todavía no hay clubes registrados.'
                }
              />
            ) : (
              filteredHomeClubs.map((club) => (
                <AppCard key={club.id} onPress={() => router.push(`/club/${club.id}` as any)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={club.name} photo={club.logo_url} size="md" style={{ marginBottom: 0 } as any} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{club.name}</Text>
                      {club.city || club.location ? (
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                          {[club.city, club.location].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                  </View>
                </AppCard>
              ))
            )}

            <SectionHeader
              title="Torneos disponibles"
              action={
                <PressableScale
                  onPress={() => router.push('/tournaments' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Ver todos los torneos"
                >
                  <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>
                    Ver todos
                  </Text>
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
              <TournamentCarousel
                tournaments={upcomingTournaments}
                cardWidth={tournamentCarouselCardWidth}
                onPressTournament={(id) => router.push(`/tournament/${id}` as any)}
              />
            )}
          </>
        )}
      </TabScrollView>
      {profilePhoto ? (
        <ProfilePhotoViewer
          visible={showPhotoViewer}
          photo={profilePhoto}
          name={user?.name || 'Perfil'}
          onClose={() => setShowPhotoViewer(false)}
        />
      ) : null}
    </Screen>
  );
}
