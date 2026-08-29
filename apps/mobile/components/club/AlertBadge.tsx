import { Text, View } from 'react-native';
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
              top: 2,
              right: 2,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: ui.colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              borderWidth: 2,
              borderColor: ui.colors.bg,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
