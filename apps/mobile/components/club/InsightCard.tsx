import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppCard, PressableScale } from '@/components/ui';
import type { BriefingCard, BriefingSeverity } from '@/lib/club-manager';
import { ui } from '@/theme/tokens';

function severityMeta(severity: BriefingSeverity) {
  switch (severity) {
    case 'critical':
      return {
        color: ui.colors.danger,
        soft: ui.colors.dangerSoft,
        icon: 'alert-circle' as const,
      };
    case 'warn':
      return {
        color: ui.colors.warning,
        soft: ui.colors.warningSoft,
        icon: 'warning' as const,
      };
    case 'success':
      return {
        color: ui.colors.success,
        soft: ui.colors.successSoft,
        icon: 'checkmark-circle' as const,
      };
    case 'opportunity':
      return {
        color: '#F97316',
        soft: 'rgba(249,115,22,0.14)',
        icon: 'sparkles' as const,
      };
    case 'action':
      return {
        color: ui.colors.primary,
        soft: ui.colors.primarySoft,
        icon: 'flash' as const,
      };
    default:
      return {
        color: '#3B82F6',
        soft: 'rgba(59,130,246,0.14)',
        icon: 'information-circle' as const,
      };
  }
}

type InsightCardProps = {
  card: BriefingCard;
  onAction?: () => void;
};

export function InsightCard({ card, onAction }: InsightCardProps) {
  const meta = severityMeta(card.severity);
  return (
    <AppCard padding="sm" style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <View
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: meta.color,
            alignSelf: 'stretch',
            minHeight: 40,
          }}
        />
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: meta.soft,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 12,
            marginRight: 12,
          }}
        >
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
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
          {card.action && card.actionLabel && onAction ? (
            <PressableScale onPress={onAction} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: ui.radius.md,
                  backgroundColor: ui.colors.primarySoft,
                }}
              >
                <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>
                  {card.actionLabel}
                </Text>
              </View>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </AppCard>
  );
}
