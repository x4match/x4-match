import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserBadge } from '@/lib/types';
import { badgePalette, resolveBadgeIcon } from '@/lib/badges-ui';
import { ui } from '@/theme/tokens';
import { AppCard } from '@/components/ui';

type BadgesSectionProps = {
  badges?: UserBadge[] | null;
  earnedCount?: number;
  total?: number;
  title?: string;
  compact?: boolean;
  onPress?: () => void;
};

export function BadgesSection({
  badges,
  earnedCount,
  total,
  title = 'Insignias',
  compact = false,
  onPress,
}: BadgesSectionProps) {
  const list = badges ?? [];
  const countLabel =
    earnedCount != null && total != null ? `${earnedCount}/${total}` : String(list.length);

  return (
    <AppCard style={{ width: '100%' }} padding={compact ? 'sm' : 'md'} onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: compact ? 14 : 16, color: ui.colors.textPrimary }}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: ui.colors.primary }}>{countLabel}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={14} color={ui.colors.primary} /> : null}
        </View>
      </View>

      {list.length === 0 ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>
          {onPress
            ? 'Tocá para ver todas las insignias y cómo desbloquearlas.'
            : 'Todavía no desbloqueaste insignias. Jugá partidos con resultado confirmado para ganarlas.'}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
            {list.map((badge) => {
              const palette = badgePalette(badge.category);
              const iconName = resolveBadgeIcon(badge.icon);
              return (
                <View
                  key={badge.id}
                  style={{
                    width: compact ? 92 : 104,
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderRadius: ui.radius.md,
                    backgroundColor: palette.bg,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: ui.colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name={iconName} size={18} color={palette.color} />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: ui.colors.textPrimary,
                      textAlign: 'center',
                      minHeight: 28,
                    }}
                  >
                    {badge.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {onPress ? (
        <Text style={{ fontSize: 11, color: ui.colors.primary, fontWeight: '600', marginTop: 10 }}>
          Ver catálogo completo
        </Text>
      ) : null}
    </AppCard>
  );
}
