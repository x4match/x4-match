import { ScrollView, Text, View, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { mapTournament } from '@/lib/mappers';
import type { Tournament } from '@/lib/types';
import { playerFitsTournamentCategory } from '@/lib/tournament/types';
import { ui } from '@/theme/tokens';
import { Screen, AppHeader, AppCard, EmptyState, FadeInUp, SkeletonCard, TournamentCard } from '@/components/x4match';

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
      <AppHeader title="Torneos" showBack />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: ui.spacing.lg, paddingBottom: 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/history' as any)}
        >
          <AppCard padding="sm">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(20,184,166,0.12)',
                }}
              >
                <Ionicons name="time-outline" size={22} color={ui.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                  Historial de organización
                </Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                  Torneos que organizaste
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        </TouchableOpacity>

        {playerCategory ? (
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 4 }}>
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
              <TournamentCard
                tournament={t}
                onPress={() => router.push(`/tournament/${t.id}` as any)}
              />
            </FadeInUp>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
