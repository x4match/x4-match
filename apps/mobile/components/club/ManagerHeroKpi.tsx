import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppCard } from '@/components/ui';
import { CurrencyAmount } from '@/components/club/CurrencyAmount';
import { ui } from '@/theme/tokens';

type ManagerHeroKpiProps = {
  title: string;
  amount: number;
  amountLabel?: string;
  deltaPct: number;
  deltaLabel: string;
  hint?: string;
  tone?: 'success' | 'danger' | 'default';
};

export function ManagerHeroKpi({
  title,
  amount,
  deltaPct,
  deltaLabel,
  hint,
  tone = 'default',
}: ManagerHeroKpiProps) {
  const deltaColor =
    tone === 'success'
      ? ui.colors.success
      : tone === 'danger'
        ? ui.colors.danger
        : ui.colors.textSecondary;
  const deltaIcon =
    deltaPct > 0 ? 'trending-up' : deltaPct < 0 ? 'trending-down' : 'remove-outline';

  return (
    <AppCard variant="gradient" padding="lg" style={{ marginBottom: 20 }} glow>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: ui.colors.textSecondary,
          letterSpacing: 0.3,
        }}
      >
        {title}
      </Text>
      <CurrencyAmount amount={amount} size="hero" style={{ marginTop: 10 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <Ionicons name={deltaIcon} size={16} color={deltaColor} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: deltaColor }}>{deltaLabel}</Text>
      </View>
      {hint ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 8 }}>{hint}</Text>
      ) : null}
    </AppCard>
  );
}
