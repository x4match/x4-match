import { Text, View } from 'react-native';
import { PressableScale } from '@/components/ui';
import type { BriefingCard, BriefingSeverity } from '@/lib/club/club-manager';
import { ui } from '@/theme/tokens';

function isAlertSeverity(severity: BriefingSeverity) {
  return severity === 'critical' || severity === 'warn' || severity === 'action';
}

type InsightCardProps = {
  card: BriefingCard;
  onAction?: () => void;
};

/** Bloque interno de insight (va dentro de la AppCard de la sección). */
export function InsightCard({ card, onAction }: InsightCardProps) {
  const alert = isAlertSeverity(card.severity);

  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: ui.radius.md,
        padding: 14,
        backgroundColor: alert ? 'rgba(239,68,68,0.12)' : ui.colors.surface2,
        borderWidth: 1,
        borderColor: alert ? 'rgba(239,68,68,0.28)' : ui.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: alert ? ui.colors.danger : ui.colors.primary,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 14 }}>
            {card.title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: ui.colors.textSecondary,
              marginTop: 4,
              lineHeight: 17,
            }}
          >
            {card.body}
          </Text>
        </View>
        {card.action && card.actionLabel && onAction ? (
          <PressableScale onPress={onAction}>
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: ui.radius.pill,
                backgroundColor: ui.colors.primary,
              }}
            >
              <Text style={{ color: ui.colors.onPrimary, fontWeight: '700', fontSize: 13 }}>
                {card.actionLabel}
              </Text>
            </View>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}
