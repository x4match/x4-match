import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { badgePalette, resolveBadgeIcon } from '@/lib/badges-ui';
import { formatShortDate } from '@/lib/format';
import type { BadgeCatalogItem, BadgesSummary } from '@/lib/types';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, EmptyState } from '@/components/padely';

function BadgeCatalogCard({
  badge,
  onPress,
  lockedLabel = 'Bloqueada',
}: {
  badge: BadgeCatalogItem;
  onPress?: () => void;
  lockedLabel?: string;
}) {
  const palette = badgePalette(badge.category);
  const earned = badge.earned;
  const iconName = earned ? resolveBadgeIcon(badge.icon) : 'lock-closed';

  return (
    <AppCard
      onPress={onPress}
      padding="sm"
      style={{
        width: '48%',
        flexGrow: 1,
        opacity: earned ? 1 : 0.72,
        marginBottom: 0,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: earned ? palette.bg : ui.colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <Ionicons name={iconName} size={24} color={earned ? palette.color : ui.colors.textMuted} />
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 13,
            fontWeight: '800',
            color: ui.colors.textPrimary,
            textAlign: 'center',
            minHeight: 34,
          }}
        >
          {badge.name}
        </Text>
        <Text
          numberOfLines={3}
          style={{
            fontSize: 11,
            color: ui.colors.textSecondary,
            textAlign: 'center',
            marginTop: 6,
            minHeight: 42,
          }}
        >
          {badge.description}
        </Text>
        {earned && badge.earnedAt ? (
          <Text style={{ fontSize: 10, color: ui.colors.primary, fontWeight: '700', marginTop: 8 }}>
            Desbloqueada · {formatShortDate(badge.earnedAt)}
          </Text>
        ) : (
          <Text style={{ fontSize: 10, color: ui.colors.textMuted, fontWeight: '600', marginTop: 8 }}>
            {lockedLabel}
          </Text>
        )}
      </View>
    </AppCard>
  );
}

export default function BadgesScreen() {
  const router = useRouter();
  const { userId, name } = useLocalSearchParams<{ userId?: string; name?: string }>();
  const viewingOtherPlayer = !!userId;
  const playerName = typeof name === 'string' && name.trim() ? name.trim() : 'Jugador';

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: viewingOtherPlayer ? ['badges-user', userId] : ['badges-me'],
    queryFn: async () => {
      const res = viewingOtherPlayer
        ? await api.get(`/badges/user/${userId}`)
        : await api.get('/badges/me');
      return res.data as BadgesSummary;
    },
    enabled: !viewingOtherPlayer || !!userId,
  });

  const badges = data?.all ?? [];
  const earnedCount = data?.earnedCount ?? 0;
  const total = data?.total ?? badges.length;

  return (
    <Screen>
      <StackHeader title={viewingOtherPlayer ? `Insignias de ${playerName}` : 'Insignias'} />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />}
      >
        <AppCard style={{ marginBottom: ui.spacing.lg }}>
          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
            {viewingOtherPlayer ? `Progreso de ${playerName}` : 'Tu progreso'}
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: ui.colors.primary, marginTop: 4 }}>
            {earnedCount}/{total}
          </Text>
          <Text style={{ fontSize: 13, color: ui.colors.textMuted, marginTop: 6 }}>
            {viewingOtherPlayer
              ? 'Insignias desbloqueadas y pendientes de este jugador.'
              : 'Desbloqueá insignias jugando partidos con resultado confirmado.'}
          </Text>
        </AppCard>

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted, textAlign: 'center' }}>Cargando insignias...</Text>
        ) : badges.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="ribbon-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin insignias disponibles"
            description="Todavía no hay insignias cargadas en el catálogo."
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {badges.map((badge) => (
              <BadgeCatalogCard
                key={badge.id}
                badge={badge}
                lockedLabel={viewingOtherPlayer ? 'Sin desbloquear' : 'Bloqueada'}
                onPress={
                  badge.earned && badge.matchId
                    ? () => router.push(`/match/${badge.matchId}` as any)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
