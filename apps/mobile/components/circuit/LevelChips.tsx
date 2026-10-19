import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LEVELS, levelLabel } from '@/lib/circuits/organizer';
import { ui } from '@/theme/tokens';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: ui.radius.pill,
        backgroundColor: active ? ui.colors.primarySoft : ui.colors.surface1,
        borderWidth: 1,
        borderColor: active ? ui.colors.primary : ui.colors.border,
        marginRight: 8,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? ui.colors.primary : ui.colors.textPrimary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Selector horizontal de categoría (1ra … 8va); con `allLabel` agrega la opción "todas". */
export function LevelChips({
  value,
  onChange,
  allLabel,
}: {
  value: number | null;
  onChange: (level: number | null) => void;
  allLabel?: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {allLabel ? <Chip label={allLabel} active={value == null} onPress={() => onChange(null)} /> : null}
      {LEVELS.map((level) => (
        <Chip key={level} label={levelLabel(level)} active={value === level} onPress={() => onChange(level)} />
      ))}
    </ScrollView>
  );
}

export function LevelBadge({ level, muted }: { level: number | null | undefined; muted?: boolean }) {
  const known = level != null;
  return (
    <View
      style={{
        minWidth: 44,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: ui.radius.pill,
        alignItems: 'center',
        backgroundColor: known && !muted ? ui.colors.primarySoft : ui.colors.cardMuted,
        borderWidth: 1,
        borderColor: known && !muted ? ui.colors.primary : ui.colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: known && !muted ? ui.colors.primary : ui.colors.textMuted,
        }}
      >
        {known ? levelLabel(level) : 'S/C'}
      </Text>
    </View>
  );
}
