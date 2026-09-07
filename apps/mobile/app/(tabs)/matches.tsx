import { useState, useCallback, useMemo } from 'react';
import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub, isPlayer } from '@/lib/roles';
import { mapMatch, safeMapCircuit, mapTournament } from '@/lib/mappers';
import type { Match, Circuit, Tournament } from '@/lib/types';
import { formatShortDate, formatTime, startOfDay } from '@/lib/format';
import { playerFitsTournamentCategory } from '@/lib/tournament/types';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  StatusPill,
  PrimaryButton,
  EmptyState,
  Avatar,
  SegmentedControl,
  MonthlyCalendar,
} from '@/components/padely';

type MainTab = 'matches' | 'tournaments';
type MatchesTab = 'upcoming' | 'history';

type CompetitionItem =
  | { kind: 'tournament'; id: string; data: Tournament; dayKey: string | null }
  | { kind: 'circuit'; id: string; data: Circuit; dayKey: string | null };

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

export default function MatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('matches');
  const [matchesTab, setMatchesTab] = useState<MatchesTab>('upcoming');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const isClubAccount = isClub(user?.role);
  const isStaffAccount = isClubAccount;

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
    enabled: mainTab === 'tournaments',
  });

  const { data: circuits, isLoading: loadingCircuits, refetch: refetchCircuits } = useQuery({
    queryKey: ['circuits-tab'],
    queryFn: async () => {
      const res = await api.get('/circuits');
      return res.data;
    },
    enabled: mainTab === 'tournaments',
  });

  const isLoading = mainTab === 'matches' ? loadingMatches : loadingTournaments || loadingCircuits;

  const onRefresh = useCallback(() => {
    if (mainTab === 'matches') {
      refetchMatches();
      return;
    }
    refetchTournaments();
    refetchCircuits();
  }, [mainTab, refetchMatches, refetchTournaments, refetchCircuits]);

  const all: Match[] = (matches || []).map(mapMatch);
  const upcoming = all.filter((m) => ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS'].includes(m.status));
  const history = all.filter((m) => ['FINISHED', 'CANCELLED', 'DISPUTED'].includes(m.status));
  const matchList = matchesTab === 'upcoming' ? upcoming : history;

  const playerCategory = user?.levelCategory ?? user?.declaredCategory;

  const tournamentList: Tournament[] = useMemo(() => {
    const mapped = (tournaments || []).map(mapTournament);
    if (!isPlayer(user?.role)) return mapped;
    return mapped.filter((t: Tournament) =>
      playerFitsTournamentCategory(playerCategory, t.category),
    );
  }, [tournaments, user?.role, playerCategory]);

  const circuitList: Circuit[] = useMemo(
    () =>
      (circuits || [])
        .map(safeMapCircuit)
        .filter((c: Circuit | null): c is Circuit => c != null && Boolean(c.id)),
    [circuits],
  );

  const competitionItems: CompetitionItem[] = useMemo(() => {
    const items: CompetitionItem[] = [
      ...tournamentList.map((t) => {
        const start = tournamentStart(t);
        return {
          kind: 'tournament' as const,
          id: `tournament-${t.id}`,
          data: t,
          dayKey: start ? toDayKey(start) : null,
        };
      }),
      ...circuitList.map((c) => {
        const day = circuitDay(c);
        return {
          kind: 'circuit' as const,
          id: `circuit-${c.id}`,
          data: c,
          dayKey: day ? toDayKey(day) : null,
        };
      }),
    ];

    items.sort((a, b) => {
      if (a.dayKey && b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      if (a.dayKey) return -1;
      if (b.dayKey) return 1;
      return a.data.name.localeCompare(b.data.name);
    });

    return items;
  }, [tournamentList, circuitList]);

  const competitionDayKeys = useMemo(
    () => competitionItems.map((item) => item.dayKey).filter((key): key is string => !!key),
    [competitionItems],
  );

  const filteredCompetitions = useMemo(() => {
    if (!selectedCalendarDate) return competitionItems;
    const selectedKey = toDayKey(selectedCalendarDate);
    if (!selectedKey) return competitionItems;
    return competitionItems.filter((item) => item.dayKey === selectedKey);
  }, [competitionItems, selectedCalendarDate]);

  const handleCalendarChange = useCallback((date: Date) => {
    setSelectedCalendarDate((prev) => {
      if (prev && startOfDay(prev).getTime() === startOfDay(date).getTime()) return null;
      return date;
    });
  }, []);

  return (
    <Screen>
      <AppHeader title="Partidos" />
      <View style={{ marginHorizontal: ui.spacing.lg, marginBottom: ui.spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'matches', label: 'Partidos' },
            { value: 'tournaments', label: 'Torneos' },
          ]}
          value={mainTab}
          onChange={setMainTab}
        />
      </View>

      {mainTab === 'matches' ? (
        <>
          {isStaffAccount ? (
            <View style={{ paddingHorizontal: ui.spacing.lg }}>
              <AppCard>
                <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary, marginBottom: 8 }}>
                  {isClubAccount ? 'Cuenta de club' : 'Cuenta de organizador'}
                </Text>
                <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 16 }}>
                  {isClubAccount
                    ? 'Publicá horarios libres de canchas desde la pestaña Horarios.'
                    : 'Gestioná torneos y circuitos desde el panel de organización.'}
                </Text>
                <PrimaryButton
                  label={isClubAccount ? 'Ir a horarios' : 'Ir al panel'}
                  onPress={() =>
                    router.push((isClubAccount ? '/(tabs)/court-slots' : '/(tabs)/organizer') as any)
                  }
                  variant="dark"
                  fullWidth
                />
              </AppCard>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: ui.spacing.lg, marginBottom: 16 }}>
                {(['upcoming', 'history'] as const).map((key) => (
                  <View key={key} style={{ flex: 1 }}>
                    <PrimaryButton
                      label={key === 'upcoming' ? `Próximos (${upcoming.length})` : `Historial (${history.length})`}
                      onPress={() => setMatchesTab(key)}
                      variant={matchesTab === key ? 'primary' : 'ghost'}
                      fullWidth
                      size="sm"
                      style={matchesTab !== key ? { backgroundColor: ui.colors.surface } : undefined}
                    />
                  </View>
                ))}
              </View>

              <ScrollView
                contentContainerStyle={tabScreenPadding}
                refreshControl={
                  <RefreshControl refreshing={loadingMatches} onRefresh={refetchMatches} tintColor={ui.colors.primary} />
                }
              >
                {matchList.length === 0 ? (
                  <EmptyState
                    icon={<Ionicons name="calendar-outline" size={32} color={ui.colors.textMuted} />}
                    title={matchesTab === 'upcoming' ? 'Sin partidos próximos' : 'Sin historial'}
                    description={
                      matchesTab === 'upcoming'
                        ? 'Unite a un partido abierto o creá uno nuevo'
                        : 'Acá vas a ver tus partidos jugados'
                    }
                    action={
                      matchesTab === 'upcoming' ? (
                        <PrimaryButton label="Buscar partido" onPress={() => router.push('/browse-open-matches' as any)} />
                      ) : undefined
                    }
                  />
                ) : (
                  matchList.map((match) => (
                    <AppCard key={match.id} onPress={() => router.push(`/match/${match.id}` as any)}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary }}>{match.title}</Text>
                          <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>{match.club?.name}</Text>
                        </View>
                        <StatusPill status={match.status} />
                      </View>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 10 }}>
                        {formatShortDate(match.date)} · {formatTime(match.date)}
                        {match.zone ? ` · ${match.zone}` : ''}
                      </Text>
                      {match.result?.score ? (
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Resultado: {match.result.score}</Text>
                      ) : (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row' }}>
                            {match.players.map((p, i) => (
                              <Avatar
                                key={p.id}
                                name={p.name}
                                size="sm"
                                style={{ marginLeft: i > 0 ? -8 : 0 }}
                                borderColor={ui.colors.card}
                              />
                            ))}
                          </View>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                            {match.joinedCount}/{match.neededPlayers}
                          </Text>
                        </View>
                      )}
                    </AppCard>
                  ))
                )}
              </ScrollView>

              {matchesTab === 'upcoming' && upcoming.length > 0 && (
                <View style={{ position: 'absolute', bottom: 24, right: 20, left: 20 }}>
                  <PrimaryButton
                    label="+ Nuevo partido"
                    onPress={() => router.push('/create-open-match' as any)}
                    fullWidth
                    size="lg"
                  />
                </View>
              )}
            </>
          )}
        </>
      ) : (
        <ScrollView
          contentContainerStyle={tabScreenPadding}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />
          }
        >
          <MonthlyCalendar
            value={selectedCalendarDate}
            onChange={handleCalendarChange}
            minDate={null}
            markedDates={competitionDayKeys}
          />

          {selectedCalendarDate ? (
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12 }}>
              Torneos del {formatShortDate(selectedCalendarDate)}
              {' · '}
              <Text
                style={{ color: ui.colors.primary, fontWeight: '600' }}
                onPress={() => setSelectedCalendarDate(null)}
              >
                Ver todos
              </Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginBottom: 12 }}>
              Los días con punto tienen torneos
            </Text>
          )}

          {filteredCompetitions.length === 0 && !isLoading ? (
            <EmptyState
              icon={<Ionicons name="trophy-outline" size={32} color={ui.colors.textMuted} />}
              title={selectedCalendarDate ? 'Sin torneos ese día' : 'Sin torneos'}
              description={
                selectedCalendarDate
                  ? 'Probá otro día o mirá el listado completo'
                  : 'No hay torneos disponibles en este momento'
              }
            />
          ) : (
            filteredCompetitions.map((item) => {
              if (item.kind === 'tournament') {
                const t = item.data;
                return (
                  <AppCard key={item.id} onPress={() => router.push(`/tournament/${t.id}` as any)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: ui.colors.warningSoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="trophy" size={24} color={ui.colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 8,
                          }}
                        >
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, flex: 1 }}>{t.name}</Text>
                          <StatusPill status={t.status} />
                        </View>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                          {[
                            t.category ? `Cat. ${t.category}` : null,
                            t.startDate ? formatShortDate(t.startDate) : null,
                            t.maxTeams ? `${t.maxTeams} equipos máx.` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                    </View>
                  </AppCard>
                );
              }

              const c = item.data;
              return (
                <AppCard key={item.id} onPress={() => router.push(`/circuit/${c.id}` as any)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: ui.colors.primarySoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="trophy" size={24} color={ui.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, flex: 1 }}>{c.name}</Text>
                        <StatusPill status={c.status} />
                      </View>
                      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                        {[
                          c.season,
                          c.venueCount != null && c.venueCount > 0
                            ? `${c.venueCount} sede${c.venueCount !== 1 ? 's' : ''}`
                            : null,
                          c.categoryCount != null && c.categoryCount > 0 ? `${c.categoryCount} cat.` : null,
                          c.nextStageDate ? `Próx: ${formatShortDate(c.nextStageDate)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
                  </View>
                </AppCard>
              );
            })
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
