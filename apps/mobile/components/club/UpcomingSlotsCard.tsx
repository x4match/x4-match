import { Text, View } from 'react-native';
import { AppCard, PrimaryButton } from '@/components/ui';
import type { ManagerUpcomingSlot } from '@/lib/club/club-manager';
import { ui } from '@/theme/tokens';

type UpcomingSlotsCardProps = {
  title: string;
  subtitle?: string;
  rows: ManagerUpcomingSlot[];
  emptyText: string;
  onViewAgenda?: () => void;
};

function StatusBadge({ status }: { status: string }) {
  const open = status === 'OPEN';
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: ui.radius.pill,
        borderWidth: 1,
        borderColor: open ? ui.colors.primary : ui.colors.borderStrong,
        backgroundColor: 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: open ? ui.colors.primary : ui.colors.textSecondary,
        }}
      >
        {open ? 'Libre' : 'Reservado'}
      </Text>
    </View>
  );
}

export function UpcomingSlotsCard({
  title,
  subtitle,
  rows,
  emptyText,
  onViewAgenda,
}: UpcomingSlotsCardProps) {
  return (
    <AppCard padding="md" style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>{title}</Text>
      {subtitle ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>{subtitle}</Text>
      ) : null}

      {rows.length === 0 ? (
        <Text style={{ color: ui.colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 14 }}>
          {emptyText}
        </Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {rows.map((row, index) => (
            <View
              key={row.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: ui.colors.border,
              }}
            >
              <Text
                style={{
                  width: 52,
                  fontSize: 15,
                  fontWeight: '700',
                  color: ui.colors.primary,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {row.timeLabel}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontWeight: '600',
                  color: ui.colors.textPrimary,
                  fontSize: 14,
                }}
                numberOfLines={1}
              >
                {row.courtLabel}
              </Text>
              <StatusBadge status={row.status} />
            </View>
          ))}
        </View>
      )}

      {onViewAgenda ? (
        <PrimaryButton
          label="Ver agenda"
          size="sm"
          fullWidth
          variant="outline"
          onPress={onViewAgenda}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </AppCard>
  );
}
