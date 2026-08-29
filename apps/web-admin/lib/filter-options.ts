import {
  BILLING_STATUS_LABELS,
  MATCH_STATUS_LABELS,
  MP_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_LABELS,
  TRIAL_MODE_LABELS,
  USER_ROLE_LABELS,
  optionsFromLabels,
} from '@/lib/labels';

export const USER_ROLES = optionsFromLabels(USER_ROLE_LABELS, 'Todos los roles');
export const BILLING_STATUSES = optionsFromLabels(BILLING_STATUS_LABELS, 'Todos los estados');
export const MP_STATUSES = optionsFromLabels(MP_STATUS_LABELS, 'Mercado Pago');
export const MATCH_STATUSES = optionsFromLabels(MATCH_STATUS_LABELS, 'Todos los estados');
export const TOURNAMENT_STATUSES = optionsFromLabels(TOURNAMENT_STATUS_LABELS, 'Todos los estados');
export const PAYMENT_STATUSES = optionsFromLabels(PAYMENT_STATUS_LABELS, 'Todos los estados');
export const TRIAL_MODES = optionsFromLabels(TRIAL_MODE_LABELS, 'Todos los modos');

export const TRIAL_STATUSES = [
  { value: '', label: 'Todos los estados' },
  ...['NOT_STARTED', 'TRIAL', 'GRACE'].map((value) => ({
    value,
    label: BILLING_STATUS_LABELS[value] ?? value,
  })),
];

export const EXPIRING_OPTIONS = [
  { value: '', label: 'Vencimiento' },
  { value: '7', label: 'Vence en ≤ 7 días' },
  { value: '14', label: 'Vence en ≤ 14 días' },
  { value: '30', label: 'Vence en ≤ 30 días' },
] as const;
