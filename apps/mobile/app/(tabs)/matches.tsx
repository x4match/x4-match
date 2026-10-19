import { useState, useCallback, useMemo, type ReactNode } from 'react';
import {
  Text,
  View,
  RefreshControl,
  Pressable,
  TextInput,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub, isPlayer } from '@/lib/roles';
import { mapMatch, mapTournament, safeMapCircuit } from '@/lib/mappers';
import { useCircuitsEnabled } from '@/lib/features';
import type { Match, Tournament, Circuit, MatchStatus } from '@/lib/types';
import {
  formatShortDate,
  formatMatchCourtWhen,
  startOfDay,
} from '@/lib/format';
import {
  FIXED_CATEGORY_OPTIONS,
  playerFitsTournamentCategory,
} from '@/lib/tournament/types';
import { fontFamily } from '@/theme/tokens';
import { getTabScreenPaddingBottom } from '@/lib/layout';
import {
  Screen,
  Avatar,
  MonthlyCalendar,
  TournamentCard,
  PressableScale,
  TabScrollView,
  SearchableSelect,
  SegmentedControl,
} from '@/components/x4match';
import {
  MatchesCalendarIcon,
  MATCHES_CALENDAR_ICON_SIZE,
  MatchesMetaDateIcon,
  MatchesMetaClockIcon,
  MatchesArrowIcon,
} from '@/components/x4match/MatchesIcons';
import { hapticSelection } from '@/lib/haptics';
import { ClubMatchesPanel } from '@/components/club/ClubMatchesPanel';
import { TourTarget, useScreenTour, type TourStep } from '@/components/tour/ScreenTour';

const MATCHES_TOUR_STEPS: TourStep[] = [
  {
    target: 'matches.sections',
    title: 'Partidos, torneos y circuitos',
    description:
      'Cambiá entre tus partidos, los torneos con inscripción abierta y los circuitos (ligas con varias fechas y ranking propio).',
  },
  {
    target: 'matches.filters',
    title: 'Próximos e historial',
    description:
      '"Próximos" son los partidos a los que te sumaste: tocá uno para ver el detalle y, al terminar, cargar el resultado para que los rivales lo confirmen. "Historial" guarda los partidos jugados.',
  },
];

type MainTab = 'matches' | 'tournaments' | 'circuits';
type MatchesTab = 'upcoming' | 'history';

const GLASS_CARD: ViewStyle = {
  backgroundColor: 'rgba(20,20,24,0.75)',
  borderRadius: 22,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
};

const MUTED = '#8E8E9F';
const LIME = '#D7FF00';

function toDayKey(date: string | Date): string | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tournamentStart(t: Tournament): string | undefined {
  return t.startDate || t.start_date;
}

function circuitDay(c: Circuit): string | undefined {
  return c.nextStageDate || c.startDate;
}

function compareTournaments(a: Tournament, b: Tournament) {
  const featuredDiff = (b.featuredPriority ?? 0) - (a.featuredPriority ?? 0);
  if (featuredDiff !== 0) return featuredDiff;
  const priceDiff = (b.price ?? b.entryFee ?? 0) - (a.price ?? a.entryFee ?? 0);
  if (priceDiff !== 0) return priceDiff;
  const aStart = tournamentStart(a);
  const bStart = tournamentStart(b);
  if (aStart && bStart) return aStart.localeCompare(bStart);
  return a.name.localeCompare(b.name);
}

function compareCircuits(a: Circuit, b: Circuit) {
  const aDay = circuitDay(a);
  const bDay = circuitDay(b);
  if (aDay && bDay) return aDay.localeCompare(bDay);
  if (aDay) return -1;
  if (bDay) return 1;
  return a.name.localeCompare(b.name);
}

/** Adapta un circuito al modelo visual de TournamentCard. */
function circuitToCardTournament(c: Circuit): Tournament {
  const firstCat = c.categories?.[0];
  const firstVenue = c.venues?.[0];
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    startDate: c.nextStageDate || c.startDate,
    endDate: c.endDate,
    category: firstCat?.label || c.season || undefined,
    gender: firstCat?.gender,
    clubName: firstVenue?.clubName,
    venueCount: c.venueCount,
    description: c.description,
  };
}

function formatRelativeDayLabel(date: string | Date): string {
  const d = startOfDay(typeof date === 'string' ? new Date(date) : date);
  const today = startOfDay(new Date());
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  return formatShortDate(date);
}

function formatMatchMetaWhen(match: Match): string {
  return formatMatchCourtWhen(match, formatRelativeDayLabel(match.date));
}

function matchEyebrow(match: Match): string {
  const kind =
    match.status === 'OPEN'
      ? 'Partido abierto'
      : match.status === 'FULL'
        ? 'Partido completo'
        : match.status === 'CONFIRMED'
          ? 'Partido confirmado'
          : match.status === 'IN_PROGRESS'
            ? 'En juego'
            : match.status === 'FINISHED'
              ? 'Partido jugado'
              : match.status === 'CANCELLED'
                ? 'Partido cancelado'
                : match.status === 'DISPUTED'
                  ? 'Partido en disputa'
                  : 'Partido';
  return `${kind} — ${match.title}`.toUpperCase();
}

function matchHeadline(match: Match, playerCategory?: string | null): string {
  if (match.result?.score) return `Resultado: ${match.result.score}`;
  const spots = Math.max(0, match.neededPlayers - match.joinedCount);
  const spotsLabel =
    spots === 0 ? 'Completo' : `${spots} para completar`;
  //if (playerCategory) return `${spotsLabel} · tu cat. ${playerCategory}`;
  return spotsLabel;
}

function statusBadgeStyle(status: MatchStatus | string): {
  label: string;
  bg: string;
  border: string;
  text: string;
} {
  if (status === 'OPEN') {
    return {
      label: 'Abierto',
      bg: 'rgba(215,255,0,0.15)',
      border: 'rgba(215,255,0,0.25)',
      text: LIME,
    };
  }
  const map: Record<string, { label: string; bg: string; border: string; text: string }> = {
    FULL: { label: 'Completo', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', text: '#FFFFFF' },
    CONFIRMED: { label: 'Confirmado', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.28)', text: '#22C55E' },
    IN_PROGRESS: { label: 'En juego', bg: 'rgba(215,255,0,0.12)', border: 'rgba(215,255,0,0.22)', text: LIME },
    FINISHED: { label: 'Finalizado', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', text: MUTED },
    CANCELLED: { label: 'Cancelado', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.28)', text: '#EF4444' },
    DISPUTED: { label: 'Sin acuerdo', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.28)', text: '#F59E0B' },
  };
  return (
    map[status] ?? {
      label: String(status),
      bg: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.1)',
      text: MUTED,
    }
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
    <View
      style={[
        GLASS_CARD,
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 28,
          gap: 12,
          minHeight: 192,
          width: '100%',
        },
      ]}
    >
      {icon}
      <View style={{ alignItems: 'center', gap: 6, maxWidth: 240 }}>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22.5,
            fontFamily: fontFamily.regular,
            color: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19.5,
            fontFamily: fontFamily.regular,
            color: MUTED,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      </View>
      {action ? <View style={{ paddingTop: 4 }}>{action}</View> : null}
    </View>
  );
}

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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 100,
        backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderWidth: 1,
        borderColor: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          lineHeight: 19.5,
          fontFamily: fontFamily.regular,
          color: active ? '#FFFFFF' : MUTED,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MatchStatusBadge({ status }: { status: MatchStatus | string }) {
  const cfg = statusBadgeStyle(status);
  return (
    <View
      style={{
        backgroundColor: cfg.bg,
        borderWidth: 1,
        borderColor: cfg.border,
        borderRadius: 100,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          lineHeight: 16.5,
          fontFamily: fontFamily.bold,
          fontWeight: '700',
          color: cfg.text,
        }}
      >
        {cfg.label}
      </Text>
    </View>
  );
}

function MatchJoinCta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: LIME,
        borderRadius: 100,
        paddingLeft: 22,
        paddingRight: 12,
        paddingVertical: 12,
        width: '100%',
        shadowColor: LIME,
        shadowOpacity: 0.27,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          lineHeight: 24,
          letterSpacing: -0.16,
          fontFamily: fontFamily.regular,
          color: '#000000',
        }}
      >
        {label}
      </Text>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MatchesArrowIcon width={16} height={16} />
      </View>
    </PressableScale>
  );
}

function MatchCard({
  match,
  playerCategory,
  ctaLabel,
  onPress,
}: {
  match: Match;
  playerCategory?: string | null;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={[GLASS_CARD, { padding: 18, width: '100%' }]}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontSize: 10,
                lineHeight: 15,
                letterSpacing: 0.8,
                fontFamily: fontFamily.bold,
                fontWeight: '700',
                color: MUTED,
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {matchEyebrow(match)}
            </Text>
            <Text
              style={{
                fontSize: 17,
                lineHeight: 25.5,
                letterSpacing: -0.17,
                fontFamily: fontFamily.regular,
                color: '#FFFFFF',
              }}
              numberOfLines={2}
            >
              {matchHeadline(match, playerCategory)}
            </Text>
          </View>
          <MatchStatusBadge status={match.status} />
        </View>

        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 13, height: 13 }}>
              <MatchesMetaDateIcon width={13} height={13} />
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19.5, fontFamily: fontFamily.regular, color: MUTED, flex: 1 }}>
              {formatMatchMetaWhen(match)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 13, height: 13 }}>
              <MatchesMetaClockIcon width={13} height={13} />
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19.5, fontFamily: fontFamily.regular, color: MUTED }}>
              Lugares libres:{' '}
              <Text style={{ color: '#FFFFFF' }}>
                {match.joinedCount}/{match.neededPlayers}
              </Text>
            </Text>
          </View>
        </View>

        {match.players.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {match.players.slice(0, 4).map((p, i) => (
              <Avatar
                key={p.id}
                name={p.name}
                photo={p.photo}
                size="sm"
                style={{ marginLeft: i > 0 ? -8 : 0 }}
                borderColor="rgba(20,20,24,0.75)"
              />
            ))}
          </View>
        ) : null}

        <MatchJoinCta label={ctaLabel} onPress={onPress} />
      </View>
    </View>
  );
}

export default function MatchesScreen() {
  const { user } = useAuth();
  if (isClub(user?.role)) {
    return <ClubMatchesPanel />;
  }
  return <PlayerMatchesScreen />;
}

function PlayerMatchesScreen() {
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('matches');
  const [matchesTab, setMatchesTab] = useState<MatchesTab>('upcoming');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [competitionQuery, setCompetitionQuery] = useState('');
  const [competitionCategory, setCompetitionCategory] = useState<string | null>(null);
  const isTournamentsTab = mainTab === 'tournaments';
  const isCircuitsTab = mainTab === 'circuits';
  const isCompetitionsTab = isTournamentsTab || isCircuitsTab;
  useScreenTour('matches', MATCHES_TOUR_STEPS, { enabled: mainTab === 'matches' });

  const { data: matches, isLoading: loadingMatches, refetch: refetchMatches } = useQuery({
    queryKey: ['my-matches'],
    queryFn: async () => {
      const res = await api.get('/matches/me');
      return res.data;
    },
    enabled: mainTab === 'matches' && isPlayer(user?.role),
  });

  const { data: tournaments, isLoading: loadingTournaments, refetch: refetchTournaments } = useQuery({
    queryKey: ['tournaments-tab'],
    queryFn: async () => {
      const res = await api.get('/tournaments');
      return res.data;
    },
    enabled: isTournamentsTab,
  });

  const { data: myTournaments, refetch: refetchMyTournaments } = useQuery({
    queryKey: ['tournaments-tab-mine'],
    queryFn: async () => {
      const res = await api.get('/tournaments/mine');
      return res.data;
    },
    enabled: isTournamentsTab && !!user,
  });

  const { data: circuits, isLoading: loadingCircuits, refetch: refetchCircuits } = useQuery({
    queryKey: ['circuits-tab'],
    queryFn: async () => {
      const res = await api.get('/circuits');
      return res.data;
    },
    enabled: isCircuitsTab && circuitsEnabled,
  });

  const isLoading = mainTab === 'matches'
    ? loadingMatches
    : isTournamentsTab
      ? loadingTournaments
      : loadingCircuits;

  const onRefresh = useCallback(() => {
    if (mainTab === 'matches') {
      refetchMatches();
      return;
    }
    if (isTournamentsTab) {
      refetchTournaments();
      if (user) refetchMyTournaments();
      return;
    }
    if (circuitsEnabled) refetchCircuits();
  }, [
    mainTab,
    isTournamentsTab,
    user,
    refetchMatches,
    refetchTournaments,
    refetchMyTournaments,
    refetchCircuits,
  ]);

  const handleMainTabChange = useCallback((tab: MainTab) => {
    setMainTab(tab);
    setSelectedCalendarDate(null);
    setCompetitionQuery('');
    setCompetitionCategory(null);
  }, []);

  const all: Match[] = (matches || []).map(mapMatch);
  const upcoming = all.filter((m) => ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS'].includes(m.status));
  const history = all.filter((m) => ['FINISHED', 'CANCELLED', 'DISPUTED'].includes(m.status));
  const matchList = matchesTab === 'upcoming' ? upcoming : history;

  const playerCategory = user?.levelCategory ?? user?.declaredCategory;

  const tournamentList: Tournament[] = useMemo(() => {
    const mine: Tournament[] = (myTournaments || [])
      .map(mapTournament)
      .filter((t: Tournament) => !t.isPast && t.status !== 'CANCELLED');
    const mineIds = new Set(mine.map((t) => t.id));
    const publicList: Tournament[] = (tournaments || [])
      .map(mapTournament)
      .filter((t: Tournament) => !mineIds.has(t.id));
    const visiblePublic = isPlayer(user?.role)
      ? publicList.filter((t) => playerFitsTournamentCategory(playerCategory, t.category))
      : publicList;
    return [...mine, ...visiblePublic];
  }, [tournaments, myTournaments, user?.role, playerCategory]);

  const circuitList: Circuit[] = useMemo(
    () =>
      (circuits || [])
        .map(safeMapCircuit)
        .filter((c: Circuit | null): c is Circuit => c != null && Boolean(c.id)),
    [circuits],
  );

  const sortedTournaments = useMemo(
    () => [...tournamentList].sort(compareTournaments),
    [tournamentList],
  );

  const sortedCircuits = useMemo(
    () => [...circuitList].sort(compareCircuits),
    [circuitList],
  );

  const competitionDayKeys = useMemo(() => {
    if (isCircuitsTab) {
      return sortedCircuits
        .map((c) => {
          const day = circuitDay(c);
          return day ? toDayKey(day) : null;
        })
        .filter((key): key is string => !!key);
    }
    return sortedTournaments
      .map((t) => {
        const start = tournamentStart(t);
        return start ? toDayKey(start) : null;
      })
      .filter((key): key is string => !!key);
  }, [isCircuitsTab, sortedCircuits, sortedTournaments]);

  const categoryFilterOptions = useMemo(() => {
    if (isCircuitsTab) {
      const labels = new Set<string>();
      for (const c of sortedCircuits) {
        for (const cat of c.categories || []) {
          if (cat.label?.trim()) labels.add(cat.label.trim());
        }
      }
      return [
        { value: '__all__', label: 'Todas las categorías' },
        ...Array.from(labels)
          .sort((a, b) => a.localeCompare(b))
          .map((cat) => ({ value: cat, label: cat })),
      ];
    }
    return [
      { value: '__all__', label: 'Todas las categorías' },
      ...FIXED_CATEGORY_OPTIONS.map((cat) => ({ value: cat, label: cat })),
    ];
  }, [isCircuitsTab, sortedCircuits]);

  const filteredTournaments = useMemo(() => {
    const q = competitionQuery.trim().toLowerCase();
    return sortedTournaments.filter((t) => {
      if (selectedCalendarDate) {
        const selectedKey = toDayKey(selectedCalendarDate);
        const start = tournamentStart(t);
        const dayKey = start ? toDayKey(start) : null;
        if (selectedKey && dayKey !== selectedKey) return false;
      }

      if (competitionCategory && (t.category || '') !== competitionCategory) return false;

      if (!q) return true;
      const haystack = [t.name, t.clubName, t.category, t.gender]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedTournaments, selectedCalendarDate, competitionQuery, competitionCategory]);

  const filteredCircuits = useMemo(() => {
    const q = competitionQuery.trim().toLowerCase();
    return sortedCircuits.filter((c) => {
      if (selectedCalendarDate) {
        const selectedKey = toDayKey(selectedCalendarDate);
        const day = circuitDay(c);
        const dayKey = day ? toDayKey(day) : null;
        if (selectedKey && dayKey !== selectedKey) return false;
      }

      if (competitionCategory) {
        const hasCat = (c.categories || []).some(
          (cat) => (cat.label || '').trim() === competitionCategory,
        );
        if (!hasCat) return false;
      }

      if (!q) return true;
      const haystack = [
        c.name,
        c.season,
        c.description,
        ...(c.venues || []).map((v) => v.clubName),
        ...(c.categories || []).map((cat) => [cat.label, cat.gender].filter(Boolean).join(' ')),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedCircuits, selectedCalendarDate, competitionQuery, competitionCategory]);

  const handleCalendarChange = useCallback((date: Date) => {
    setSelectedCalendarDate((prev) => {
      if (prev && startOfDay(prev).getTime() === startOfDay(date).getTime()) return null;
      return date;
    });
  }, []);

  const titleStyle: TextStyle = {
    fontSize: 28,
    lineHeight: 42,
    letterSpacing: -0.56,
    fontFamily: fontFamily.regular,
    color: '#FFFFFF',
  };

  const contentPadBottom = getTabScreenPaddingBottom(insets.bottom, 24);

  return (
    <Screen>
      <TabScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: contentPadBottom,
          gap: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={LIME} />
        }
      >
        <Text style={titleStyle}>Partidos</Text>

        <TourTarget id="matches.sections">
          <SegmentedControl
            value={mainTab}
            onChange={handleMainTabChange}
            options={[
              { value: 'matches', label: 'Partidos' },
              { value: 'tournaments', label: 'Torneos' },
              { value: 'circuits', label: 'Circuitos' },
            ]}
          />
        </TourTarget>

        {mainTab === 'matches' ? (
          <>
            <TourTarget id="matches.filters" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start' }}>
              <FilterChip
                label={`Próximos (${upcoming.length})`}
                active={matchesTab === 'upcoming'}
                onPress={() => setMatchesTab('upcoming')}
              />
              <FilterChip
                label={`Historial (${history.length})`}
                active={matchesTab === 'history'}
                onPress={() => setMatchesTab('history')}
              />
            </TourTarget>

            <View style={{ gap: 12, width: '100%' }}>
              {matchList.length === 0 ? (
                <GlassEmpty
                  icon={
                    <MatchesCalendarIcon
                      width={MATCHES_CALENDAR_ICON_SIZE.width}
                      height={MATCHES_CALENDAR_ICON_SIZE.height}
                    />
                  }
                  title={matchesTab === 'upcoming' ? 'Sin partidos próximos' : 'Sin historial'}
                  description={
                    matchesTab === 'upcoming'
                      ? 'Unite a un partido o crea uno nuevo'
                      : 'Acá vas a ver tus partidos jugados'
                  }
                  action={
                    matchesTab === 'upcoming' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Buscar partido"
                        onPress={() => {
                          void hapticSelection();
                          router.push('/browse-open-matches' as any);
                        }}
                        style={{
                          backgroundColor: LIME,
                          borderRadius: 100,
                          paddingHorizontal: 24,
                          paddingVertical: 10,
                          shadowColor: LIME,
                          shadowOpacity: 0.27,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 4 },
                          elevation: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            lineHeight: 19.5,
                            fontFamily: fontFamily.regular,
                            color: '#000000',
                            textAlign: 'center',
                          }}
                        >
                          Buscar partido
                        </Text>
                      </Pressable>
                    ) : undefined
                  }
                />
              ) : (
                matchList.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    playerCategory={playerCategory}
                    ctaLabel="Ver partido"
                    onPress={() => router.push(`/match/${match.id}` as any)}
                  />
                ))
              )}
            </View>
          </>
        ) : isCircuitsTab && !circuitsEnabled ? (
          <GlassEmpty
            icon={<Ionicons name="construct-outline" size={28} color={LIME} />}
            title="Circuitos en construcción"
            description="Estamos terminando el módulo de circuitos. Muy pronto vas a poder jugarlos desde acá."
          />
        ) : isCompetitionsTab ? (
          <>
            <MonthlyCalendar
              value={selectedCalendarDate}
              onChange={handleCalendarChange}
              minDate={null}
              markedDates={competitionDayKeys}
            />

            {selectedCalendarDate ? (
              <Text style={{ fontSize: 13, color: MUTED }}>
                {isCircuitsTab ? 'Circuitos' : 'Torneos'} del {formatShortDate(selectedCalendarDate)}
                {' · '}
                <Text
                  style={{ color: LIME, fontFamily: fontFamily.semibold }}
                  onPress={() => setSelectedCalendarDate(null)}
                >
                  Ver todos
                </Text>
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: MUTED }}>
                Los días con punto tienen {isCircuitsTab ? 'circuitos' : 'torneos'}
              </Text>
            )}

            <View style={{ gap: 10, width: '100%' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 14,
                  minHeight: 48,
                }}
              >
                <Ionicons name="search" size={18} color={MUTED} />
                <TextInput
                  value={competitionQuery}
                  onChangeText={setCompetitionQuery}
                  placeholder={isCircuitsTab ? 'Buscar circuitos...' : 'Buscar torneos...'}
                  placeholderTextColor={MUTED}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    lineHeight: 20,
                    fontFamily: fontFamily.regular,
                    color: '#FFFFFF',
                  }}
                />
                {competitionQuery.length > 0 ? (
                  <Pressable
                    onPress={() => setCompetitionQuery('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar búsqueda"
                  >
                    <Ionicons name="close-circle" size={18} color={MUTED} />
                  </Pressable>
                ) : null}
              </View>

              {isTournamentsTab ? <SearchableSelect
                placeholder="Todas las categorías"
                searchPlaceholder="Buscar categoría..."
                value={competitionCategory ?? '__all__'}
                options={categoryFilterOptions}
                onChange={(value) =>
                  setCompetitionCategory(value === '__all__' ? null : value)
                }
                renderTrigger={({ open, selected, placeholder }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Filtrar por categoría"
                    onPress={open}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.08)',
                      paddingHorizontal: 14,
                      minHeight: 48,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        lineHeight: 20,
                        fontFamily: fontFamily.regular,
                        color: selected?.value === '__all__' || !selected ? MUTED : '#FFFFFF',
                      }}
                      numberOfLines={1}
                    >
                      {selected?.label || placeholder}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={MUTED} />
                  </Pressable>
                )}
              /> : null}
            </View>

            {isCircuitsTab ? (
              filteredCircuits.length === 0 && !isLoading ? (
                <GlassEmpty
                  icon={<Ionicons name="trophy-outline" size={28} color={MUTED} />}
                  title={
                    selectedCalendarDate
                      ? 'Sin circuitos ese día'
                      : competitionQuery || competitionCategory
                        ? 'Sin resultados'
                        : 'Sin circuitos'
                  }
                  description={
                    selectedCalendarDate
                      ? 'Probá otro día o mirá el listado completo'
                      : competitionQuery || competitionCategory
                        ? 'Probá otra búsqueda o categoría'
                        : 'No hay circuitos disponibles en este momento'
                  }
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {filteredCircuits.map((c) => {
                    const cats = c.categoryCount ?? c.categories?.length ?? 0;
                    const sedes = c.venueCount ?? c.venues?.length ?? 0;
                    return (
                      <TournamentCard
                        key={c.id}
                        tournament={circuitToCardTournament(c)}
                        ctaLabel="Ver circuito"
                        statValue={String(cats || sedes)}
                        statLabel={cats > 0 ? 'CATS' : 'SEDES'}
                        onPress={() => router.push(`/circuit/${c.id}` as any)}
                      />
                    );
                  })}
                </View>
              )
            ) : filteredTournaments.length === 0 && !isLoading ? (
              <GlassEmpty
                icon={<Ionicons name="trophy-outline" size={28} color={MUTED} />}
                title={
                  selectedCalendarDate
                    ? 'Sin torneos ese día'
                    : competitionQuery || competitionCategory
                      ? 'Sin resultados'
                      : 'Sin torneos'
                }
                description={
                  selectedCalendarDate
                    ? 'Probá otro día o mirá el listado completo'
                    : competitionQuery || competitionCategory
                      ? 'Probá otra búsqueda o categoría'
                      : 'No hay torneos disponibles en este momento'
                }
              />
            ) : (
              <View style={{ gap: 12 }}>
                {filteredTournaments.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    ctaLabel="Ver torneo"
                    onPress={() => router.push(`/tournament/${t.id}` as any)}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}
      </TabScrollView>
    </Screen>
  );
}
