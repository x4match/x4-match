import { Text, View } from 'react-native';
import { AppCard, PrimaryButton } from '@/components/ui';
import type { ManagerUpcomingSlot } from '@/lib/club-manager';
import { ui } from '@/theme/tokens';

type UpcomingSlotsCardProps = {
  rows: ManagerUpcomingSlot[];
  emptyText: string;
  onViewAgenda?: () => void;
};

export function UpcomingSlotsCard({ rows, emptyText, onViewAgenda }: UpcomingSlotsCardProps) {
  if (rows.length === 0) {
    return (
      <AppCard style={{ marginBottom: 20 }}>
        <Text style={{ color: ui.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          {emptyText}
        </Text>
        {onViewAgenda ? (
          <PrimaryButton
            label="Ver agenda"
            size="sm"
            fullWidth
            onPress={onViewAgenda}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </AppCard>
    );
  }

  return (
    <AppCard style={{ marginBottom: 20 }} padding="md">
      <View style={{ gap: 12 }}>
        {rows.map((row) => (
          <View
            key={row.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: ui.colors.border,
            }}
          >
            <Text
              style={{
                width: 56,
                fontSize: 14,
                fontWeight: '800',
                color: ui.colors.primary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {row.timeLabel}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: ui.colors.textPrimary, fontSize: 13 }}>
                {row.courtLabel}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color:
                    row.status === 'OPEN' ? ui.colors.warning : ui.colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {row.playerLabel}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {onViewAgenda ? (
        <PrimaryButton
          label="Ver agenda"
          size="sm"
          fullWidth
          onPress={onViewAgenda}
          style={{ marginTop: 4 }}
        />
      ) : null}
    </AppCard>
  );
}
