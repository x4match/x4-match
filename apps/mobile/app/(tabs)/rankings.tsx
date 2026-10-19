import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { safeMapCircuit, mapTournament } from '@/lib/mappers';
import type { Circuit, Tournament } from '@/lib/types';
import { formatShortDate } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  StatusPill,
  EmptyState,
  SegmentedControl,
  TournamentCard,
  CircuitsUnderConstruction,
} from '@/components/x4match';
import { useCircuitsEnabled } from '@/lib/features';

type TabMode = 'tournaments' | 'circuits';

export default function TournamentsTabScreen() {
  const router = useRouter();
  const circuitsEnabled = useCircuitsEnabled();
  const [mode, setMode] = useState<TabMode>(circuitsEnabled ? 'circuits' : 'tournaments');

  const { data: tournaments, isLoading: loadingTournaments, refetch: refetchTournaments } = useQuery({
    queryKey: ['tournaments-tab'],
    queryFn: async () => {
      const res = await api.get('/tournaments');
      return res.data;
    },
    enabled: mode === 'tournaments',
  });

  const { data: circuits, isLoading: loadingCircuits, refetch: refetchCircuits } = useQuery({
    queryKey: ['circuits-tab'],
    queryFn: async () => {
      const res = await api.get('/circuits');
      return res.data;
    },
    enabled: mode === 'circuits' && circuitsEnabled,
  });

  const isLoading = mode === 'tournaments' ? loadingTournaments : circuitsEnabled && loadingCircuits;
  const onRefresh = useCallback(() => {
    if (mode === 'tournaments') refetchTournaments();
    else if (circuitsEnabled) refetchCircuits();
  }, [mode, refetchTournaments, refetchCircuits]);

  const tournamentList: Tournament[] = (tournaments || []).map(mapTournament);
  const circuitList: Circuit[] = (circuits || [])
    .map(safeMapCircuit)
    .filter((c: Circuit | null): c is Circuit => c != null && Boolean(c.id));

  return (
    <Screen>
      <AppHeader title="Torneos" />
      <View style={{ marginHorizontal: ui.spacing.lg, marginBottom: ui.spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'circuits', label: 'Circuitos' },
            { value: 'tournaments', label: 'Torneos' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        {mode === 'tournaments' ? (
          tournamentList.length === 0 && !isLoading ? (
            <EmptyState
              icon={<Ionicons name="trophy-outline" size={32} color={ui.colors.textMuted} />}
              title="Sin torneos"
              description="No hay torneos disponibles en este momento"
            />
          ) : (
            tournamentList.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                onPress={() => router.push(`/tournament/${t.id}` as any)}
              />
            ))
          )
        ) : !circuitsEnabled ? (
          <CircuitsUnderConstruction />
        ) : circuitList.length === 0 && !isLoading ? (
          <EmptyState
            icon={<Ionicons name="git-network-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin circuitos"
            description="Todavía no hay circuitos publicados"
          />
        ) : (
          circuitList.map((c) => (
            <AppCard key={c.id} onPress={() => router.push(`/circuit/${c.id}` as any)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: 'rgba(20,184,166,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="git-network" size={24} color={ui.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, flex: 1 }}>{c.name}</Text>
                    <StatusPill status={c.status} />
                  </View>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                    {[
                      c.season,
                      c.venueCount != null && c.venueCount > 0 ? `${c.venueCount} sede${c.venueCount !== 1 ? 's' : ''}` : null,
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
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
