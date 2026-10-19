import { Text, View } from 'react-native';
import { ui } from '@/theme/tokens';
import { clampSkillScore, formatSkillScore, skillProgressInCategory } from '@/lib/skill';

type SkillProgressProps = {
  score?: number | null;
  category?: string;
  label?: string;
  size?: 'sm' | 'md';
  dark?: boolean;
};

const heightBySize = {
  sm: 6,
  md: 8,
};

export function SkillProgress({
  score,
  category,
  label = 'Nivel',
  size = 'md',
  dark = false,
}: SkillProgressProps) {
  const hasScore = score != null && !Number.isNaN(Number(score));
  const value = hasScore ? clampSkillScore(score) : 0;
  const percent = hasScore ? skillProgressInCategory(value, category) : 0;
  const titleColor = dark ? ui.colors.textMuted : ui.colors.textSecondary;
  const valueColor = dark ? ui.colors.textInverse : ui.colors.textPrimary;
  const mutedColor = dark ? ui.colors.textMuted : ui.colors.textSecondary;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: size === 'sm' ? 11 : 12, color: titleColor }}>{label}</Text>
        <Text style={{ fontSize: size === 'sm' ? 11 : 12, fontWeight: '700', color: valueColor }}>
          {hasScore ? formatSkillScore(value) : 'Sin nivel'}
          {category ? ` · ${category}` : ''}
        </Text>
      </View>
      <View
        style={{
          height: heightBySize[size],
          borderRadius: ui.radius.pill,
          backgroundColor: dark ? ui.colors.surfaceAlt : ui.colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${percent}%`,
            maxWidth: '100%',
            height: '100%',
            borderRadius: ui.radius.pill,
            backgroundColor: ui.colors.primary,
            alignSelf: 'flex-start',
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10, color: mutedColor }}>0</Text>
        <Text style={{ fontSize: 10, color: mutedColor }}>{category || '1000'}</Text>
      </View>
      {!hasScore ? (
        <Text style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>Todavía sin nivel asignado</Text>
      ) : null}
    </View>
  );
}
