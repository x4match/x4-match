import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui';
import { ui } from '@/theme/tokens';

export type QuickActionItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

const COLS = 3;
const GAP = 10;

export function ManagerQuickActions({ actions }: { actions: QuickActionItem[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -GAP / 2,
        marginBottom: 20,
      }}
    >
      {actions.map((action) => (
        <View
          key={action.id}
          style={{
            width: `${100 / COLS}%`,
            paddingHorizontal: GAP / 2,
            marginBottom: GAP,
          }}
        >
          <PressableScale onPress={action.onPress} style={{ width: '100%' }}>
            <View
              style={{
                backgroundColor: ui.colors.surface1,
                borderRadius: ui.radius.lg,
                borderWidth: 1,
                borderColor: ui.colors.border,
                paddingVertical: 14,
                paddingHorizontal: 8,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 92,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: ui.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Ionicons name={action.icon} size={18} color={ui.colors.primary} />
              </View>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: ui.colors.textPrimary,
                  textAlign: 'center',
                  lineHeight: 14,
                }}
              >
                {action.label}
              </Text>
            </View>
          </PressableScale>
        </View>
      ))}
    </View>
  );
}
