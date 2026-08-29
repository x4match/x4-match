import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppCard } from '@/components/ui';
import type { ManagerComparisonMetric } from '@/lib/club-manager';
import { ui } from '@/theme/tokens';

function Delta({ label, pct }: { label: string; pct: number }) {
  const up = pct > 0;
  const down = pct < 0;
  const color = up ? ui.colors.success : down ? ui.colors.danger : ui.colors.textMuted;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: ui.colors.textMuted, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Ionicons
          name={up ? 'arrow-up' : down ? 'arrow-down' : 'remove'}
          size={12}
          color={color}
        />
        <Text style={{ fontSize: 13, fontWeight: '800', color, fontVariant: ['tabular-nums'] }}>
          {Math.abs(pct)}%
        </Text>
      </View>
    </View>
  );
}

export function ComparisonStrip({ metrics }: { metrics: ManagerComparisonMetric[] }) {
  return (
    <View style={{ marginBottom: 20, gap: 10 }}>
      {metrics.map((m) => (
        <AppCard key={m.id} padding="sm">
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: ui.colors.textPrimary,
              marginBottom: 10,
            }}
          >
            {m.label}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <Delta label="vs ayer" pct={m.vsYesterdayPct} />
            <Delta label="vs semana" pct={m.vsWeekPct} />
            <Delta label="vs mes" pct={m.vsMonthPct} />
          </View>
        </AppCard>
      ))}
    </View>
  );
}
