import { View, Text } from 'react-native';
import { PressableScale } from './PressableScale';
import { hapticSelection } from '@/lib/haptics';
import { ui } from '@/theme/tokens';

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View
      style={{
        flexDirection: 'row',
        width: '100%',
        backgroundColor: ui.colors.surface1,
        borderRadius: ui.radius.pill,
        padding: 4,
        borderWidth: 1,
        borderColor: ui.colors.border,
        gap: 4,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <View key={option.value} style={{ flex: 1 }}>
            <PressableScale
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                void hapticSelection();
                onChange(option.value);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: ui.radius.pill,
                backgroundColor: active ? ui.colors.primarySoft : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: active ? ui.colors.primary : 'transparent',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: ui.typography.label.fontFamily,
                  fontSize: 13,
                  textAlign: 'center',
                  color: active ? ui.colors.primary : ui.colors.textSecondary,
                }}
              >
                {option.label}
              </Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}
