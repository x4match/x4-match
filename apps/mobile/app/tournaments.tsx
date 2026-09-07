import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { mapTournament } from '@/lib/mappers';
import type { Tournament } from '@/lib/types';
import { formatShortDate } from '@/lib/format';
import { formatTournamentCategory, playerFitsTournamentCategory } from '@/lib/tournament/types';
import { ui } from '@/theme/tokens';
import { Screen, AppHeader, AppCard, StatusPill, EmptyState, FadeInUp, SkeletonCard } from '@/components/padely';

export default function TournamentsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['tournaments-player-profile'],
    queryFn: async () => {
      const res = await api.get('/users/profile');
      return res.data as { levelCategory?: string; declaredCategory?: string };
    },
  });

  const playerCategory =
    profile?.levelCategory ?? user?.levelCategory ?? profile?.declaredCategory ?? user?.declaredCategory;

  const { data: tournaments, isLoading, refetch } = useQuery({
    queryKey: ['tournaments-list'],
    queryFn: async () => {
      const res = await api.get('/tournaments');
      return res.data;
    },
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  const list: Tournament[] = useMemo(() => {
    return (tournaments || [])
      .map(mapTournament)
      .filter((t: Tournament) => playerFitsTournamentCategory(playerCategory, t.category));
  }, [tournaments, playerCategory]);

  return (
    <Screen>
      <AppHeader title="Torneos" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: ui.spacing.lg, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        {playerCategory ? (
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12 }}>
            Mostrando torneos de tu categoría:{' '}
            <Text style={{ color: ui.colors.primary, fontWeight: '700' }}>{playerCategory}</Text>
          </Text>
        ) : null}
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="trophy-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin torneos para tu categoría"
            description={
              playerCategory
                ? `No hay torneos publicados en ${playerCategory} (ni por suma donde puedas jugar)`
                : 'Completá tu categoría de juego para ver torneos disponibles'
            }
          />
        ) : (
          list.map((t, index) => (
            <FadeInUp key={t.id} index={index}>
            <AppCard variant="elevated" onPress={() => router.push(`/tournament/${t.id}` as any)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: ui.colors.textPrimary, flex: 1 }}>{t.name}</Text>
                <StatusPill status={t.status} />
              </View>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                {formatTournamentCategory(t.category, t.gender)}
                {t.startDate ? ` · ${formatShortDate(t.startDate)}` : ''}
              </Text>
            </AppCard>
            </FadeInUp>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
