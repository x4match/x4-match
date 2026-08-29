import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatRelativeTime, formatShortDate, formatTime } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import { Screen, StackHeader, AppCard, EmptyState } from '@/components/padely';

type RecentMatchRow = {
  match_id: string;
  score: string;
  winner_team?: string | null;
  created_at: string;
  title?: string | null;
  date?: string | null;
  mode?: string | null;
  club_id?: string | null;
  club_name?: string | null;
};

export default function RecentMatchesScreen() {
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['community-recent-matches'],
    queryFn: async () => {
      const res = await api.get('/community/recent-matches', { params: { limit: 40 } });
      return res.data as RecentMatchRow[];
    },
  });

  return (
    <Screen>
      <StackHeader title="Últimos partidos" />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <Text style={{ fontSize: 14, color: ui.colors.textSecondary, marginBottom: ui.spacing.lg }}>
          Resultados cargados recientemente en la comunidad.
        </Text>

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando partidos...</Text>
        ) : !data?.length ? (
          <EmptyState
            icon={<Ionicons name="tennisball-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin resultados"
            description="Cuando se carguen resultados de partidos, aparecerán acá."
          />
        ) : (
          data.map((match) => (
            <AppCard
              key={match.match_id}
              onPress={() => router.push(`/match/${match.match_id}` as any)}
              style={{ marginBottom: 8 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
                    {match.title || 'Partido'}
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                    {match.club_name || 'Sin club'}
                    {match.date ? ` · ${formatShortDate(match.date)} ${formatTime(match.date)}` : ''}
                  </Text>
                </View>
                <Text style={{ fontWeight: '800', fontSize: 16, color: ui.colors.textPrimary }}>{match.score}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                  {formatRelativeTime(match.created_at)}
                  {match.mode === 'competitive' ? ' · Competitivo' : match.mode === 'friendly' ? ' · Amistoso' : ''}
                </Text>
              </View>
            </AppCard>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
