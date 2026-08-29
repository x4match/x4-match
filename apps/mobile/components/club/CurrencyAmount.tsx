import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { currencyParts } from '@/lib/currency';
import { ui } from '@/theme/tokens';

type CurrencyAmountProps = {
  amount: number;
  size?: 'hero' | 'lg' | 'md' | 'sm';
  color?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

const SIZE = {
  hero: { symbol: 22, digit: 40, symbolOffset: 6, symbolMargin: 6 },
  lg: { symbol: 16, digit: 28, symbolOffset: 4, symbolMargin: 4 },
  md: { symbol: 14, digit: 22, symbolOffset: 3, symbolMargin: 4 },
  sm: { symbol: 12, digit: 16, symbolOffset: 2, symbolMargin: 3 },
} as const;

/**
 * Monto tipográfico: símbolo y cifra separados (evita el glifo Intl + Geist).
 */
export function CurrencyAmount({
  amount,
  size = 'md',
  color = ui.colors.textPrimary,
  style,
  textStyle,
}: CurrencyAmountProps) {
  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const { symbol, value } = currencyParts(safeAmount);
  const s = SIZE[size] ?? SIZE.md;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-end',
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            fontSize: s.symbol,
            fontWeight: '700',
            color,
            lineHeight: s.symbol + 4,
            marginBottom: s.symbolOffset,
            marginRight: s.symbolMargin,
            opacity: 0.85,
          },
          textStyle,
        ]}
      >
        {symbol}
      </Text>
      <Text
        style={[
          {
            fontSize: s.digit,
            fontWeight: '800',
            color,
            lineHeight: s.digit + 4,
          },
          textStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
