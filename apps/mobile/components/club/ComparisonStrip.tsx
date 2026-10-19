import { Text, View } from 'react-native';
import { AppCard } from '@/components/ui';
import type { ManagerComparisonMetric } from '@/lib/club/club-manager';
import { ui } from '@/theme/tokens';

function formatPct(pct: number) {
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function Cell({ value, emphasize }: { value: string; emphasize?: boolean }) {
  return (
    <Text
      style={{
        flex: 1,
        textAlign: 'right',
        fontSize: 13,
        fontWeight: emphasize ? '700' : '600',
        color: emphasize ? ui.colors.textPrimary : ui.colors.textSecondary,
        fontVariant: ['tabular-nums'],
      }}
    >
      {value}
    </Text>
  );
}

export function ComparisonStrip({
  metrics,
  periodLabel = 'Periodo 7 días',
}: {
  metrics: ManagerComparisonMetric[];
  periodLabel?: string;
}) {
  return (
    <AppCard padding="md" style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>
          Comparativos
        </Text>
        <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>{periodLabel}</Text>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 10, paddingHorizontal: 2 }}>
        <Text style={{ flex: 1.2, fontSize: 11, color: ui.colors.textMuted }} />
        <Text
          style={{
            flex: 1,
            textAlign: 'right',
            fontSize: 11,
            fontWeight: '600',
            color: ui.colors.textMuted,
          }}
        >
          Hoy
        </Text>
        <Text
          style={{
            flex: 1,
            textAlign: 'right',
            fontSize: 11,
            fontWeight: '600',
            color: ui.colors.textMuted,
          }}
        >
          Semana
        </Text>
        <Text
          style={{
            flex: 1,
            textAlign: 'right',
            fontSize: 11,
            fontWeight: '600',
            color: ui.colors.textMuted,
          }}
        >
          Mes
        </Text>
      </View>

      {metrics.map((m, index) => (
        <View
          key={m.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: ui.colors.border,
          }}
        >
          <Text
            style={{
              flex: 1.2,
              fontSize: 13,
              fontWeight: '600',
              color: ui.colors.textPrimary,
            }}
          >
            {m.label}
          </Text>
          <Cell value={formatPct(m.vsYesterdayPct)} emphasize />
          <Cell value={formatPct(m.vsWeekPct)} />
          <Cell value={formatPct(m.vsMonthPct)} />
        </View>
      ))}
    </AppCard>
  );
}
