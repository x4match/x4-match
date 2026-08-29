import { View, Text } from 'react-native';
import type { MatchStatus, TournamentStatus } from '@/lib/types';
import { ui } from '@/theme/tokens';

type StatusType = MatchStatus | TournamentStatus | string;

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  OPEN: { label: 'Abierto', bg: ui.colors.warningSoft, text: ui.colors.warning },
  FULL: { label: 'Completo', bg: ui.colors.primarySoft, text: ui.colors.primary },
  CONFIRMED: { label: 'Confirmado', bg: ui.colors.successSoft, text: ui.colors.success },
  IN_PROGRESS: { label: 'En juego', bg: ui.colors.accentSoft, text: ui.colors.accent },
  FINISHED: { label: 'Finalizado', bg: ui.colors.surface3, text: ui.colors.textSecondary },
  DISPUTED: { label: 'Sin acuerdo', bg: ui.colors.warningSoft, text: ui.colors.warning },
  CANCELLED: { label: 'Cancelado', bg: ui.colors.dangerSoft, text: ui.colors.danger },
  DRAFT: { label: 'Borrador', bg: ui.colors.surface3, text: ui.colors.textMuted },
  OPEN_REGISTRATION: { label: 'Inscripción abierta', bg: ui.colors.accentSoft, text: ui.colors.accent },
  ACTIVE: { label: 'Activo', bg: ui.colors.successSoft, text: ui.colors.success },
  PENDING: { label: 'Pendiente', bg: ui.colors.warningSoft, text: ui.colors.warning },
  APPROVED: { label: 'Aprobada', bg: ui.colors.successSoft, text: ui.colors.success },
  REJECTED: { label: 'Rechazada', bg: ui.colors.dangerSoft, text: ui.colors.danger },
  WAITLIST: { label: 'Lista de espera', bg: ui.colors.surface3, text: ui.colors.textMuted },
  INTERNAL: { label: 'Interno', bg: ui.colors.surface3, text: ui.colors.textSecondary },
  EXTERNAL: { label: 'Externo', bg: ui.colors.primarySoft, text: ui.colors.primary },
  NOT_REQUIRED: { label: 'Sin validación', bg: ui.colors.surface3, text: ui.colors.textMuted },
};

type StatusPillProps = {
  status: StatusType;
  size?: 'sm' | 'md';
};

export function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  const config = statusConfig[status] ?? {
    label: status,
    bg: ui.colors.surface3,
    text: ui.colors.textSecondary,
  };

  return (
    <View
      style={{
        backgroundColor: config.bg,
        borderRadius: ui.radius.pill,
        paddingHorizontal: size === 'md' ? 12 : 10,
        paddingVertical: size === 'md' ? 6 : 4,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: ui.colors.border,
      }}
    >
      <Text
        style={{
          color: config.text,
          fontSize: size === 'md' ? 12 : 11,
          fontFamily: ui.typography.label.fontFamily,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}
