import { Text, TouchableOpacity } from 'react-native';
import { ui } from '@/theme/tokens';

type SelectionChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  flex?: boolean;
};

export function SelectionChip({ label, selected, onPress, flex }: SelectionChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: flex ? 1 : undefined,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: ui.radius.sm,
        backgroundColor: selected ? ui.colors.primary : ui.colors.card,
        borderWidth: 1,
        borderColor: selected ? ui.colors.primary : ui.colors.border,
        alignItems: flex ? 'center' : undefined,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontWeight: '700',
          fontSize: 12,
          color: selected ? ui.colors.onPrimary : ui.colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
