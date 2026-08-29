import { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { ui } from '@/theme/tokens';

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: ui.colors.surface2,
          borderWidth: 1,
          borderColor: ui.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        {icon}
      </View>
      <Text style={[ui.typography.h3, { color: ui.colors.textPrimary, marginBottom: 6, textAlign: 'center' }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            ui.typography.bodySm,
            { color: ui.colors.textSecondary, textAlign: 'center', marginBottom: 16, maxWidth: 280 },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
