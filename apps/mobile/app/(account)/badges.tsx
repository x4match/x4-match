import { View, Text, ScrollView, RefreshControl, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { badgePalette, resolveBadgeIcon } from '@/lib/profile/badges-ui';
import { formatShortDate } from '@/lib/format';
import type { BadgeCatalogItem, BadgesSummary } from '@/lib/types';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, EmptyState } from '@/components/x4match';

const ICON_LOCK = require('../../assets/figma/auth/password.png');

function BadgeCatalogCard({
  badge,
  onPress,
}: {
  badge: BadgeCatalogItem;
  onPress?: () => void;
}) {
  const palette = badgePalette(badge.category);
  const earned = badge.earned;
  const iconName = resolveBadgeIcon(badge.icon);

  return (
    <AppCard
      onPress={onPress}
      padding="md"
      style={{
        width: '48%',
        marginBottom: 0,
        backgroundColor: '#111115',
        borderWidth: 1,
        borderColor: '#FFFFFF14',
      }}
    >
      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
        {earned ? (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: palette.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Ionicons name={iconName} size={26} color={palette.color} />
          </View>
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#1A2025',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Image
              source={ICON_LOCK}
              style={{ width: 28, height: 28, tintColor: ui.colors.primary }}
              resizeMode="contain"
            />
          </View>
        )}
        <Text
          numberOfLines={2}
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: ui.colors.textPrimary,
            textAlign: 'center',
            minHeight: 40,
          }}
        >
          {badge.name}
        </Text>
        <Text
          numberOfLines={3}
          style={{
            fontSize: 12,
            lineHeight: 16,
            color: ui.colors.textSecondary,
            textAlign: 'center',
            marginTop: 6,
            minHeight: 48,
          }}
        >
          {badge.description}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 10,
            lineHeight: 14,
            minHeight: 14,
            color: ui.colors.primary,
            fontWeight: '700',
            marginTop: 10,
          }}
        >
          {earned && badge.earnedAt ? `Desbloqueada · ${formatShortDate(badge.earnedAt)}` : ''}
        </Text>
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
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <LinearGradient
          colors={['#5B5B5B', '#FFFFFF', '#5B5B5B']}
          locations={[0.0005, 0.5241, 0.9996]}
          start={{ x: 1, y: 0.5 }}
          end={{ x: 0, y: 0.5 }}
          style={{
            borderRadius: ui.radius.lg,
            padding: 1,
            marginBottom: ui.spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: '#111115',
              borderRadius: ui.radius.lg - 1,
              padding: ui.spacing.xl,
              overflow: 'hidden',
            }}
          >
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary }}>
              {viewingOtherPlayer ? `Progreso de ${playerName}` : 'Tu progreso'}
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: ui.colors.primary,
                marginTop: 6,
                letterSpacing: -0.5,
              }}
            >
              {earnedCount}/{total}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: ui.colors.textSecondary, marginTop: 8 }}>
              {viewingOtherPlayer
                ? 'Insignias desbloqueadas y pendientes de este jugador.'
                : 'Desbloqueá insignias jugando partidos con resultado confirmado.'}
            </Text>
          </View>
        </LinearGradient>

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted, textAlign: 'center' }}>Cargando insignias...</Text>
        ) : badges.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="ribbon-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin insignias disponibles"
            description="Todavía no hay insignias cargadas en el catálogo."
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {badges.map((badge) => (
              <BadgeCatalogCard
                key={badge.id}
                badge={badge}
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
