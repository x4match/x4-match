import { View, Text, Pressable } from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { fontFamily, ui } from '@/theme/tokens';

const MUTED = '#8E8E9F';

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
  const lime = ui.colors.primary;

  return (
    <View
      style={{
        flexDirection: 'row',
        width: '100%',
        gap: 3,
        padding: 3,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <View key={option.value} style={{ flex: 1 }}>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                void hapticSelection();
                onChange(option.value);
              }}
              style={{
                height: 38,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? lime : 'transparent',
                ...(active
                  ? {
                      shadowColor: lime,
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                    }
                  : null),
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  fontFamily: fontFamily.regular,
                  textAlign: 'center',
                  color: active ? '#000000' : MUTED,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
