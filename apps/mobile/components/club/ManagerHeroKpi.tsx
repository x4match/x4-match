import { Text, View } from 'react-native';
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

  return (
    <View style={{ paddingTop: 0 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: ui.colors.textSecondary,
        }}
      >
        {title}
      </Text>
      <CurrencyAmount amount={amount} size="hero" style={{ marginTop: 6 }} />
      <Text style={{ fontSize: 13, color: deltaColor, marginTop: 8 }}>{deltaLabel}</Text>
      {hint ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
