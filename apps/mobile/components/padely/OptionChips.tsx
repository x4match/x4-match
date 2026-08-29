import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ui } from '@/theme/tokens';

type OptionChipsProps = {
  label: string;
  options: readonly string[];
  selected?: string;
  onSelect: (value: string) => void;
  horizontal?: boolean;
};

export function OptionChips({ label, options, selected, onSelect, horizontal }: OptionChipsProps) {
  const chips = options.map((option) => {
    const active = selected === option;
    return (
      <TouchableOpacity
        key={option}
        onPress={() => onSelect(option)}
        style={{
          paddingHorizontal: horizontal ? 14 : 18,
          paddingVertical: horizontal ? 8 : 10,
          borderRadius: ui.radius.pill,
          backgroundColor: active ? ui.colors.primarySoft : ui.colors.surface1,
          borderWidth: 1,
          borderColor: active ? ui.colors.primary : ui.colors.border,
          marginRight: horizontal ? 8 : 0,
          marginBottom: horizontal ? 0 : 8,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: active ? ui.colors.primary : ui.colors.textPrimary }}>
          {option}
        </Text>
      </TouchableOpacity>
    );
  });

  return (
    <View style={{ marginBottom: ui.spacing.lg }}>
      <Text style={[ui.typography.label, { color: ui.colors.textSecondary, marginBottom: 10 }]}>{label}</Text>
      {horizontal ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>{chips}</View>
        </ScrollView>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>
      )}
    </View>
  );
}
