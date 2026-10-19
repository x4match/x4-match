import { Text, View } from 'react-native';
import type { ManagerKpiTile } from '@/lib/club/club-manager';
import { CurrencyAmount } from '@/components/club/CurrencyAmount';
import { AppCard } from '@/components/ui';
import { ui } from '@/theme/tokens';

/** Detecta montos tipo "$ 9.600" / "$9.600" enviados por el API. */
function parseMoneyValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('$')) return null;
  const numeric = trimmed.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(numeric);
  return Number.isFinite(n) ? n : null;
}

function parseProgress(tile: ManagerKpiTile): number {
  const pctMatch = tile.value.match(/(\d+)\s*%/);
  if (pctMatch) return Math.min(100, Math.max(0, Number(pctMatch[1])));
  const money = parseMoneyValue(tile.value);
  if (money != null) {
    return money > 0 ? Math.min(100, 40 + Math.log10(money + 1) * 12) : 0;
  }
  return 0;
}

function KpiTile({ tile }: { tile: ManagerKpiTile }) {
  const money = parseMoneyValue(tile.value);
  const progress = parseProgress(tile);
  const isOccupancy = tile.id === 'occupancy' || tile.label.toLowerCase().includes('ocup');
  const valueColor = isOccupancy ? ui.colors.primary : ui.colors.textPrimary;

  return (
    <AppCard padding="md" style={{ flex: 1, marginBottom: 0, minWidth: '46%' }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: ui.colors.textMuted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {tile.label}
      </Text>
      {money != null ? (
        <CurrencyAmount amount={money} size="md" color={valueColor} />
      ) : (
        <Text
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: valueColor,
            fontVariant: ['tabular-nums'],
          }}
        >
          {tile.value}
        </Text>
      )}
      {tile.hint ? (
        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 6 }}>
          {tile.hint}
        </Text>
      ) : null}
      <View
        style={{
          marginTop: 14,
          height: 4,
          borderRadius: 2,
          backgroundColor: ui.colors.surface3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: ui.colors.primary,
          }}
        />
      </View>
    </AppCard>
  );
}

/** Solo ocupación + cobrado, como en el mockup de Gerente. */
export function ManagerKpiGrid({ tiles }: { tiles: ManagerKpiTile[] }) {
  const featured = tiles.filter((t) => t.id === 'occupancy' || t.id === 'collected');
  const shown = featured.length >= 2 ? featured.slice(0, 2) : tiles.slice(0, 2);

  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
      {shown.map((tile) => (
        <KpiTile key={tile.id} tile={tile} />
      ))}
    </View>
  );
}
