export type TrialChecklistKey =
  | 'contract_signed'
  | 'club_profile_complete'
  | 'mp_connected'
  | 'first_slot_published'
  | 'billing_method'
  | 'ops_approved';

export type TrialChecklistItem = {
  key: TrialChecklistKey;
  label: string;
  description: string;
  auto: boolean;
  required: boolean;
};

export const TRIAL_CHECKLIST_TEMPLATE: TrialChecklistItem[] = [
  {
    key: 'contract_signed',
    label: 'Acuerdo de trial firmado',
    description: 'Contrato o acuerdo de período de prueba firmado por el club.',
    auto: false,
    required: true,
  },
  {
    key: 'club_profile_complete',
    label: 'Perfil del club completo',
    description: 'Nombre, ciudad, teléfono y logo cargados.',
    auto: true,
    required: true,
  },
  {
    key: 'mp_connected',
    label: 'Mercado Pago conectado',
    description: 'Cuenta MP del club vinculada para cobros online.',
    auto: true,
    required: false,
  },
  {
    key: 'first_slot_published',
    label: 'Primer turno publicado',
    description: 'Al menos un turno visible para jugadores.',
    auto: true,
    required: true,
  },
  {
    key: 'billing_method',
    label: 'Método de pago x4 match',
    description: 'Medio de cobro de la suscripción post-trial (transferencia / tarjeta).',
    auto: false,
    required: false,
  },
  {
    key: 'ops_approved',
    label: 'Aprobación interna',
    description: 'Validación final del equipo x4 match.',
    auto: false,
    required: true,
  },
];

export type ChecklistItemState = {
  done: boolean;
  at?: string | null;
  by?: string | null;
  note?: string | null;
};

export type ClubBillingStatus =
  | 'NOT_STARTED'
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE'
  | 'SUSPENDED'
  | 'CANCELLED';

export type ClubTrialMode = 'TIME' | 'MANUAL';
