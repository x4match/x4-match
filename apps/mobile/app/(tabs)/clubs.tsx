import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import { Screen, AppHeader, AppCard, EmptyState, Avatar } from '@/components/padely';

export default function ClubsScreen() {
  const router = useRouter();
  const { data: clubs, isLoading, refetch } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data as {
        id: string;
        name: string;
        address?: string;
        city?: string;
        zone?: string;
        logo_url?: string;
      }[];
    },
  });

  return (
    <Screen swipeBack>
      <AppHeader title="Clubs" showBack />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={ui.colors.primary} />}
      >
        <Text style={{ fontSize: 14, color: ui.colors.textMuted, marginBottom: ui.spacing.lg }}>
          Entrá a cada club para ver ubicación, comentarios, ranking y premios.
        </Text>
        {!clubs?.length && !isLoading ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin clubs disponibles"
            description="No hay clubs registrados en tu zona"
          />
        ) : (
          (clubs || []).map((club) => (
            <AppCard key={club.id} onPress={() => router.push(`/club/${club.id}` as any)} padding="md">
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Avatar name={club.name} photo={club.logo_url} size="lg" style={{ marginBottom: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 4 }}>
                    {club.name}
                  </Text>
                  {club.address ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Ionicons name="location-outline" size={14} color={ui.colors.textSecondary} />
                      <Text style={{ fontSize: 13, color: ui.colors.textSecondary, flex: 1 }} numberOfLines={1}>
                        {club.address}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ fontSize: 12, color: ui.colors.primary, fontWeight: '600', marginTop: 4 }}>
                    Tienda · Mapa · Ranking
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ui.colors.textMuted} />
              </View>
            </AppCard>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
