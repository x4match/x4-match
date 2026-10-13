import { View, Text } from 'react-native';
import type { PlayerMatchStats } from '@/lib/types';
import { ui, fontFamily } from '@/theme/tokens';
import { AppCard } from '@/components/ui';

type StatItem = {
  label: string;
  value: number;
  dot: string;
};

type PlayerMatchStatsCardProps = {
  stats?: PlayerMatchStats | null;
  title?: string;
  compact?: boolean;
};

export function PlayerMatchStatsCard({
  stats,
  title = 'Resumen de partidos',
  compact = false,
}: PlayerMatchStatsCardProps) {
  if (!stats) return null;

  const items: StatItem[] = [
    { label: 'Ganados', value: stats.wins, dot: '#22C55E' },
    { label: 'Perdidos', value: stats.losses, dot: '#EF4444' },
    { label: 'Completados', value: stats.completed, dot: '#F5C518' },
    { label: 'Sin completar', value: stats.notCompleted, dot: '#A3A3A3' },
  ];

  return (
    <View style={{ width: '100%', gap: 10 }}>
      <Text
        style={{
          fontFamily: fontFamily.regular,
          fontWeight: '700',
          fontSize: compact ? 14 : 16,
          color: ui.colors.textPrimary,
          marginBottom: 2,
        }}
      >
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item) => (
          <AppCard
            key={item.label}
            padding="sm"
            style={{
              width: '48%',
              flexGrow: 1,
              marginBottom: 0,
              backgroundColor: ui.colors.surface1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: item.dot,
                }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fontFamily.regular,
                  color: ui.colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </View>
            <Text
              style={{
                fontSize: compact ? 26 : 30,
                fontFamily: fontFamily.regular,
                fontWeight: '700',
                color: ui.colors.textPrimary,
                lineHeight: compact ? 30 : 34,
              }}
            >
              {item.value}
            </Text>
          </AppCard>
        ))}
      </View>
      {stats.winRate != null && stats.completed > 0 ? (
        <Text style={{ fontSize: 12, fontWeight: '700', color: ui.colors.primary, marginTop: 2 }}>
          {stats.winRate}% victorias
        </Text>
      ) : null}
    </View>
  );
}
