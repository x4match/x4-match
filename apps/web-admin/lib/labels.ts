/** Etiquetas en español para valores de API / enums. Una sola fuente de verdad. */

export const USER_ROLE_LABELS: Record<string, string> = {
  PLAYER: 'Jugador',
  CLUB_ADMIN: 'Admin de club',
  ORGANIZER: 'Organizador',
  SUPER_ADMIN: 'Super admin',
};

export const BILLING_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Sin iniciar',
  TRIAL: 'Período de prueba',
  ACTIVE: 'Plan activo',
  GRACE: 'Gracia post-trial',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};

export const MP_STATUS_LABELS: Record<string, string> = {
  CONNECTED: 'Conectado',
  DISCONNECTED: 'Desconectado',
  EXPIRED: 'Expirado',
  MANUAL_ONLY: 'Solo manual',
};

export const MATCH_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto',
  FULL: 'Completo',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En juego',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
  DISPUTED: 'Disputado',
};

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  OPEN_REGISTRATION: 'Inscripción abierta',
  IN_PROGRESS: 'En curso',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};

export const TRIAL_MODE_LABELS: Record<string, string> = {
  TIME: 'Por tiempo (90 días)',
  MANUAL: 'Manual',
};

export const SUBSCRIPTION_PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito',
  BASIC: 'Básico',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

export const PROVIDER_LABELS: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  mock: 'Simulado',
};

export type LabelCategory =
  | 'userRole'
  | 'billingStatus'
  | 'mpStatus'
  | 'matchStatus'
  | 'tournamentStatus'
  | 'paymentStatus'
  | 'trialMode'
  | 'subscriptionPlan'
  | 'provider';

const LABEL_MAPS: Record<LabelCategory, Record<string, string>> = {
  userRole: USER_ROLE_LABELS,
  billingStatus: BILLING_STATUS_LABELS,
  mpStatus: MP_STATUS_LABELS,
  matchStatus: MATCH_STATUS_LABELS,
  tournamentStatus: TOURNAMENT_STATUS_LABELS,
  paymentStatus: PAYMENT_STATUS_LABELS,
  trialMode: TRIAL_MODE_LABELS,
  subscriptionPlan: SUBSCRIPTION_PLAN_LABELS,
  provider: PROVIDER_LABELS,
};

export function getStatusLabel(
  category: LabelCategory,
  value?: string | null,
  fallback = '—',
): string {
  if (value == null || value === '') return fallback;
  const map = LABEL_MAPS[category];
  if (map[value]) return map[value];
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function optionsFromLabels(
  labels: Record<string, string>,
  allLabel = 'Todos',
): { value: string; label: string }[] {
  return [
    { value: '', label: allLabel },
    ...Object.entries(labels).map(([value, label]) => ({ value, label })),
  ];
}

export function badgeTone(
  category: LabelCategory,
  value?: string | null,
): 'success' | 'warning' | 'danger' | 'neutral' {
  const v = value ?? '';
  if (category === 'billingStatus') {
    if (v === 'ACTIVE' || v === 'TRIAL') return 'success';
    if (v === 'GRACE' || v === 'NOT_STARTED') return 'warning';
    if (v === 'SUSPENDED' || v === 'CANCELLED') return 'danger';
  }
  if (category === 'mpStatus') {
    if (v === 'CONNECTED') return 'success';
    if (v === 'EXPIRED') return 'danger';
  }
  if (category === 'paymentStatus') {
    if (v === 'APPROVED') return 'success';
    if (v === 'PENDING') return 'warning';
    if (v === 'REJECTED' || v === 'CANCELLED') return 'danger';
  }
  if (category === 'matchStatus' || category === 'tournamentStatus') {
    if (v === 'OPEN' || v === 'OPEN_REGISTRATION') return 'warning';
    if (v === 'CONFIRMED' || v === 'IN_PROGRESS' || v === 'FULL') return 'success';
    if (v === 'CANCELLED' || v === 'DISPUTED') return 'danger';
    if (v === 'FINISHED') return 'neutral';
  }
  if (category === 'userRole' && v === 'SUPER_ADMIN') return 'success';
  return 'neutral';
}
