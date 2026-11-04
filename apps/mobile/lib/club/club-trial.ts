export type ClubBillingStatus =
  | 'NOT_STARTED'
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE'
  | 'SUSPENDED'
  | 'CANCELLED';

export type ClubTrialMode = 'TIME' | 'MANUAL';

export type ClubTrialStatus = {
  clubId: string;
  status: ClubBillingStatus;
  trialMode: ClubTrialMode | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialDays: number;
  daysRemaining: number | null;
  isTrialActive: boolean;
  isAccessAllowed: boolean;
  canStartTrial: boolean;
};

export function trialStatusLabel(status: ClubBillingStatus): string {
  const labels: Record<ClubBillingStatus, string> = {
    NOT_STARTED: 'Sin iniciar',
    TRIAL: 'Período de prueba',
    ACTIVE: 'Plan activo',
    GRACE: 'Gracia post-trial',
    SUSPENDED: 'Suspendido',
    CANCELLED: 'Cancelado',
  };
  return labels[status] ?? 'Sin iniciar';
}

export function trialModeLabel(mode: ClubTrialMode | null | undefined): string {
  if (!mode) return '—';
  return mode === 'TIME' ? 'Por tiempo (90 días)' : 'Manual';
}
