import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticSelection } from '@/lib/haptics';
import type { ShopPartner } from '@/lib/shop/marketplace';
import { fontFamily } from '@/theme/tokens';
import { PartnerLogo } from './PartnerLogo';
import { SHOP_LIME, SHOP_MUTED } from './theme';

export function ShopChip({
  label,
  active,
  onPress,
  leading,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  leading?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      style={[styles.chip, active ? styles.chipActive : null, leading ? styles.chipWithLeading : null]}
    >
      {leading}
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function HorizontalChips({ children, inset }: { children: React.ReactNode; inset: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -inset }}
      contentContainerStyle={{ paddingHorizontal: inset, gap: 8 }}
    >
      {children}
    </ScrollView>
  );
}

export function PartnerChips({
  partners,
  counts,
  selectedId,
  onSelect,
  inset,
}: {
  partners: ShopPartner[];
  counts: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  inset: number;
}) {
  return (
    <HorizontalChips inset={inset}>
      <ShopChip
        label="Todos"
        active={selectedId == null}
        onPress={() => onSelect(null)}
        leading={
          <View style={[styles.allIcon, selectedId == null ? { backgroundColor: SHOP_LIME } : null]}>
            <Ionicons name="grid" size={12} color={selectedId == null ? '#000' : SHOP_LIME} />
          </View>
        }
      />
      {partners.map((partner) => (
        <ShopChip
          key={partner.id}
          label={`${partner.name} (${counts.get(partner.id) ?? 0})`}
          active={selectedId === partner.id}
          onPress={() => onSelect(selectedId === partner.id ? null : partner.id)}
          leading={<PartnerLogo partner={partner} size={22} />}
        />
      ))}
    </HorizontalChips>
  );
}

export function CategoryChips({
  categories,
  selected,
  onSelect,
  inset,
}: {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  inset: number;
}) {
  if (categories.length < 2) return null;
  return (
    <HorizontalChips inset={inset}>
      <ShopChip label="Todas" active={selected == null} onPress={() => onSelect(null)} />
      {categories.map((category) => (
        <ShopChip
          key={category}
          label={category}
          active={selected === category}
          onPress={() => onSelect(selected === category ? null : category)}
        />
      ))}
    </HorizontalChips>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
  },
  chipWithLeading: {
    paddingLeft: 6,
  },
  chipActive: {
    backgroundColor: 'rgba(215,255,0,0.12)',
    borderColor: 'rgba(215,255,0,0.55)',
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    color: SHOP_MUTED,
    fontFamily: fontFamily.regular,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  allIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(215,255,0,0.14)',
  },
});
