import { Text, View } from 'react-native';
import { AppCard, PrimaryButton } from '@/components/ui';
import type { ManagerValleyRow } from '@/lib/club/club-manager';
import { ui } from '@/theme/tokens';

type DeadHoursCardProps = {
  title: string;
  subtitle?: string;
  rows: ManagerValleyRow[];
  emptyText: string;
  sectionActionLabel?: string;
  onSectionAction?: () => void;
  onCreatePromo?: (row: ManagerValleyRow) => void;
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08 → 22

function occupancyByHour(rows: ManagerValleyRow[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const row of rows) {
    if (row.hourBucket == null) continue;
    const free = row.freeHours ?? 0;
    const intensity = Math.max(0.08, Math.min(1, 1 - free / 8));
    map[row.hourBucket] = Math.min(map[row.hourBucket] ?? 1, intensity);
  }
  return map;
}

function DeadHoursChart({ rows }: { rows: ManagerValleyRow[] }) {
  const byHour = occupancyByHour(rows);

  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: 72,
          gap: 3,
        }}
      >
        {HOURS.map((hour) => {
          const level = byHour[hour];
          const fill = level != null ? level : 0.55;
          const isDead = level != null && level < 0.45;
          return (
            <View
              key={hour}
              style={{
                flex: 1,
                height: Math.max(8, Math.round(fill * 72)),
                borderRadius: 3,
                backgroundColor: isDead ? 'rgba(215,255,0,0.22)' : ui.colors.primary,
                opacity: level == null ? 0.35 : 1,
              }}
            />
          );
        })}
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text style={{ fontSize: 10, color: ui.colors.textMuted }}>08:00</Text>
        <Text style={{ fontSize: 10, color: ui.colors.textMuted }}>14:00</Text>
        <Text style={{ fontSize: 10, color: ui.colors.textMuted }}>22:00</Text>
      </View>
    </View>
  );
}

export function DeadHoursCard({
  title,
  subtitle,
  rows,
  emptyText,
  sectionActionLabel,
  onSectionAction,
}: DeadHoursCardProps) {
  return (
    <AppCard padding="md" style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textPrimary }}>{title}</Text>
      {subtitle ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 4 }}>{subtitle}</Text>
      ) : null}

      {rows.length === 0 ? (
        <Text style={{ fontSize: 13, color: ui.colors.textMuted, lineHeight: 18, marginTop: 14 }}>
          {emptyText}
        </Text>
      ) : (
        <DeadHoursChart rows={rows} />
      )}

      {sectionActionLabel && onSectionAction ? (
        <PrimaryButton
          label={sectionActionLabel}
          size="sm"
          fullWidth
          variant="outline"
          onPress={onSectionAction}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </AppCard>
  );
}
