import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Sheet } from '@/components/ui';
import {
  DEFAULT_SHOP_FILTERS,
  SHOP_PRICE_RANGES,
  SHOP_SORT_OPTIONS,
  applyShopFilters,
  type ShopFilters,
  type ShopProduct,
  type ShopSort,
} from '@/lib/shop/marketplace';
import { fontFamily } from '@/theme/tokens';
import { ShopChip } from './ShopChips';
import { SHOP_LIME, SHOP_MUTED } from './theme';

type ShopFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  filters: ShopFilters;
  products: ShopProduct[];
  onApply: (filters: ShopFilters) => void;
  newToggle?: { label: string; hint: string };
  hideOffersToggle?: boolean;
  hideStockToggle?: boolean;
  hiddenSorts?: ShopSort[];
};

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.15)', true: SHOP_LIME }}
        thumbColor={value ? '#000' : '#FFFFFF'}
      />
    </Pressable>
  );
}

export function ShopFilterSheet({
  visible,
  onClose,
  filters,
  products,
  onApply,
  newToggle = { label: 'Solo novedades', hint: 'Lo último que sumaron los partners' },
  hideOffersToggle = false,
  hideStockToggle = false,
  hiddenSorts = [],
}: ShopFilterSheetProps) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const resultCount = useMemo(() => applyShopFilters(products, draft).length, [products, draft]);
  const patch = (next: Partial<ShopFilters>) => setDraft((prev) => ({ ...prev, ...next }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtros"
      actionLabel={resultCount === 0 ? 'Sin resultados' : `Ver ${resultCount} producto${resultCount === 1 ? '' : 's'}`}
      onAction={() => {
        onApply(draft);
        onClose();
      }}
    >
      <View style={styles.topRow}>
        <Text style={styles.toggleHint}>
          {resultCount} resultado{resultCount === 1 ? '' : 's'} con estos filtros
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            patch({
              sort: DEFAULT_SHOP_FILTERS.sort,
              priceRange: DEFAULT_SHOP_FILTERS.priceRange,
              onlyOffers: false,
              onlyNew: false,
              onlyInStock: false,
            })
          }
          hitSlop={8}
        >
          <Text style={styles.resetText}>Restablecer</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Ordenar por</Text>
      <View style={styles.wrap}>
        {SHOP_SORT_OPTIONS.filter((option) => !hiddenSorts.includes(option.value)).map((option) => (
          <ShopChip
            key={option.value}
            label={option.label}
            active={draft.sort === option.value}
            onPress={() => patch({ sort: option.value })}
          />
        ))}
      </View>

      <Text style={styles.section}>Precio</Text>
      <View style={styles.wrap}>
        {SHOP_PRICE_RANGES.map((range) => (
          <ShopChip
            key={range.value}
            label={range.label}
            active={draft.priceRange === range.value}
            onPress={() => patch({ priceRange: range.value })}
          />
        ))}
      </View>

      <Text style={styles.section}>Mostrar</Text>
      <View style={styles.toggles}>
        {hideOffersToggle ? null : (
          <ToggleRow
            label="Solo ofertas"
            hint="Productos con descuento"
            value={draft.onlyOffers}
            onChange={(v) => patch({ onlyOffers: v })}
          />
        )}
        <ToggleRow
          label={newToggle.label}
          hint={newToggle.hint}
          value={draft.onlyNew}
          onChange={(v) => patch({ onlyNew: v })}
        />
        {hideStockToggle ? null : (
          <ToggleRow
            label="Con stock"
            hint="Ocultar productos agotados"
            value={draft.onlyInStock}
            onChange={(v) => patch({ onlyInStock: v })}
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resetText: {
    color: SHOP_LIME,
    fontSize: 13,
    fontFamily: fontFamily.regular,
  },
  section: {
    color: SHOP_MUTED,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
    fontFamily: fontFamily.regular,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggles: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
  toggleHint: {
    color: SHOP_MUTED,
    fontSize: 12,
    marginTop: 1,
    fontFamily: fontFamily.regular,
  },
});
