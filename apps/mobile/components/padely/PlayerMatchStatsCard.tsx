import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlayerMatchStats } from '@/lib/types';
import { ui } from '@/theme/tokens';
import { AppCard } from '@/components/ui';

type StatItem = {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

type PlayerMatchStatsCardProps = {
  stats?: PlayerMatchStats | null;
  title?: string;
  compact?: boolean;
};

export function PlayerMatchStatsCard({
  stats,
  title = 'Historial de partidos',
  compact = false,
}: PlayerMatchStatsCardProps) {
  if (!stats) return null;

  const items: StatItem[] = [
    {
      label: 'Ganados',
      value: stats.wins,
      icon: 'trophy',
      color: ui.colors.success,
      bg: ui.colors.successSoft,
    },
    {
      label: 'Perdidos',
      value: stats.losses,
      icon: 'close-circle',
      color: ui.colors.danger,
      bg: ui.colors.dangerSoft,
    },
    {
      label: 'Completados',
      value: stats.completed,
      icon: 'checkmark-done',
      color: ui.colors.primary,
      bg: ui.colors.primarySoft,
    },
    {
      label: 'Sin completar',
      value: stats.notCompleted,
      icon: 'time-outline',
      color: ui.colors.warning,
      bg: ui.colors.warningSoft,
    },
  ];

  return (
    <AppCard style={{ width: '100%' }} padding={compact ? 'sm' : 'md'}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: compact ? 14 : 16, color: ui.colors.textPrimary }}>
          {title}
        </Text>
        {stats.winRate != null && stats.completed > 0 ? (
          <Text style={{ fontSize: 12, fontWeight: '700', color: ui.colors.primary }}>
            {stats.winRate}% victorias
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{
              width: '48%',
              flexGrow: 1,
              backgroundColor: item.bg,
              borderRadius: ui.radius.md,
              padding: compact ? 10 : 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name={item.icon} size={16} color={item.color} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: item.color }}>{item.label}</Text>
            </View>
            <Text style={{ fontSize: compact ? 22 : 26, fontWeight: '800', color: item.color }}>{item.value}</Text>
          </View>
        ))}
      </View>
      {stats.total > 0 ? (
        <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 10 }}>
          {stats.total} partido{stats.total === 1 ? '' : 's'} en total
          {(stats.draws ?? 0) > 0 ? ` · ${stats.draws} empate${stats.draws === 1 ? '' : 's'}` : ''}
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 8 }}>
          Todavía no jugó partidos registrados en la app
        </Text>
      )}
    </AppCard>
  );
}
