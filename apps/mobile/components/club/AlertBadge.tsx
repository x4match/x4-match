import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui';
import { ui } from '@/theme/tokens';

type AlertBadgeProps = {
  count: number;
  onPress: () => void;
};

export function AlertBadge({ count, onPress }: AlertBadgeProps) {
  return (
    <PressableScale onPress={onPress}>
      <View style={{ padding: 6, position: 'relative' }}>
        <Ionicons name="notifications-outline" size={22} color={ui.colors.textPrimary} />
        {count > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: ui.colors.primary,
              borderWidth: 1.5,
              borderColor: ui.colors.bg,
            }}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}
