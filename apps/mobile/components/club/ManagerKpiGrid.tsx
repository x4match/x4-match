import { Text, View } from 'react-native';
import type { ManagerKpiTile } from '@/lib/club-manager';
import { CurrencyAmount } from '@/components/club/CurrencyAmount';
import { ui } from '@/theme/tokens';

function statusColor(tone?: ManagerKpiTile['statusTone']) {
  if (tone === 'success') return ui.colors.success;
  if (tone === 'warning') return ui.colors.warning;
  if (tone === 'danger') return ui.colors.danger;
  return ui.colors.textPrimary;
}

function statusSoft(tone?: ManagerKpiTile['statusTone']) {
  if (tone === 'success') return ui.colors.successSoft;
  if (tone === 'warning') return ui.colors.warningSoft;
  if (tone === 'danger') return ui.colors.dangerSoft;
  return ui.colors.surface2;
}

/** Detecta montos tipo "$ 9.600" / "$9.600" enviados por el API. */
function parseMoneyValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('$')) return null;
  const numeric = trimmed.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(numeric);
  return Number.isFinite(n) ? n : null;
}

function KpiTile({ tile }: { tile: ManagerKpiTile }) {
  const accent = statusColor(tile.statusTone);
  const money = parseMoneyValue(tile.value);

  return (
    <View
      style={{
        width: '48%',
        backgroundColor: ui.colors.surface1,
        borderRadius: ui.radius.lg,
        padding: 14,
        borderWidth: 1,
        borderColor: ui.colors.border,
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
    >
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: ui.radius.sm,
          backgroundColor: statusSoft(tile.statusTone),
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: ui.colors.textSecondary }}>
          {tile.label}
        </Text>
      </View>
      {money != null ? (
        <CurrencyAmount amount={money} size="md" color={accent} />
      ) : (
        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            color: accent,
          }}
        >
          {tile.value}
        </Text>
      )}
      {tile.hint ? (
        <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 4 }}>{tile.hint}</Text>
      ) : null}
    </View>
  );
}

export function ManagerKpiGrid({ tiles }: { tiles: ManagerKpiTile[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
      {tiles.map((tile) => (
        <KpiTile key={tile.id} tile={tile} />
      ))}
    </View>
  );
}
