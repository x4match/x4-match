import { Text, View } from 'react-native';
import { AppCard, PrimaryButton, PressableScale } from '@/components/ui';
import type { ManagerValleyRow } from '@/lib/club-manager';
import { ui } from '@/theme/tokens';

type DeadHoursCardProps = {
  rows: ManagerValleyRow[];
  emptyText: string;
  sectionActionLabel?: string;
  onSectionAction?: () => void;
  onCreatePromo?: (row: ManagerValleyRow) => void;
};

export function DeadHoursCard({
  rows,
  emptyText,
  sectionActionLabel,
  onSectionAction,
  onCreatePromo,
}: DeadHoursCardProps) {
  if (rows.length === 0) {
    return (
      <AppCard style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 13, color: ui.colors.textMuted, lineHeight: 18 }}>
          {emptyText}
        </Text>
      </AppCard>
    );
  }

  return (
    <View style={{ marginBottom: 20 }}>
      {rows.map((v) => (
        <AppCard key={v.id} padding="sm" style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{v.title}</Text>
          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
            {v.detail}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 16,
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: ui.colors.border,
            }}
          >
            <View>
              <Text style={{ fontSize: 10, color: ui.colors.textMuted }}>Horas libres</Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: ui.colors.warning,
                  marginTop: 2,
                }}
              >
                {v.freeHours ?? '—'}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: ui.colors.textMuted }}>Ingreso perdido</Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: ui.colors.danger,
                  marginTop: 2,
                }}
              >
                {v.lostRevenueLabel ?? '—'}
              </Text>
            </View>
          </View>
          {onCreatePromo ? (
            <PressableScale
              onPress={() => onCreatePromo(v)}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: ui.radius.md,
                  backgroundColor: ui.colors.accentSoft,
                }}
              >
                <Text style={{ color: ui.colors.accentDark, fontWeight: '700', fontSize: 13 }}>
                  {v.action?.label || 'Crear promoción'}
                </Text>
              </View>
            </PressableScale>
          ) : null}
        </AppCard>
      ))}
      {sectionActionLabel && onSectionAction ? (
        <PrimaryButton
          label={sectionActionLabel}
          size="sm"
          fullWidth
          onPress={onSectionAction}
          style={{ marginTop: 4 }}
        />
      ) : null}
    </View>
  );
}
