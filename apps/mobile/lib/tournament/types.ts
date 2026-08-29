export type TournamentStatus =
  | 'DRAFT'
  | 'OPEN_REGISTRATION'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'CANCELLED';

export type TournamentModality = 'INTERNAL' | 'EXTERNAL';
export type ClubValidationStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type TournamentInviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITLIST';
export type TournamentMatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED';

export interface TournamentInvite {
  id: string;
  tournament_id: string;
  invited_user_id?: string | null;
  invited_by_user_id: string;
  status: TournamentInviteStatus;
  invited_user_name?: string | null;
  invited_user_photo?: string | null;
  invited_user_nickname?: string | null;
  created_at: string;
  accepted_at?: string | null;
}

export interface TournamentDate {
  id: string;
  tournament_id: string;
  play_date: string;
  label?: string | null;
  notes?: string | null;
}

export interface TournamentRegistration {
  id: string;
  tournament_id: string;
  created_by_user_id?: string | null;
  player1_user_id?: string | null;
  player2_user_id?: string | null;
  player1_name: string;
  player2_name: string;
  player1_email?: string | null;
  player2_email?: string | null;
  player1_photo?: string | null;
  player2_photo?: string | null;
  phone?: string | null;
  category?: string | null;
  status: RegistrationStatus;
  seed?: number | null;
  payment_required: boolean;
  payment_status?: PaymentStatus | null;
  payment_amount?: number | null;
  payment_checkout_url?: string | null;
  payment_paid_at?: string | null;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  date_id?: string | null;
  round: number;
  round_label?: string | null;
  group_name?: string | null;
  court_label?: string | null;
  team_a_registration_id?: string | null;
  team_b_registration_id?: string | null;
  team_a_name?: string | null;
  team_b_name?: string | null;
  status: TournamentMatchStatus;
  score?: { sets: { teamA: number; teamB: number }[]; setsA?: number; setsB?: number } | null;
  winner_registration_id?: string | null;
  scheduled_at?: string | null;
}

export interface TournamentDetail {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  format?: string | null;
  gender?: string | null;
  club_id?: string | null;
  club_name?: string | null;
  start_date?: string | null;
  max_teams?: number | null;
  courts_available?: number | null;
  price?: number | string | null;
  payment_required?: boolean;
  rules?: string | null;
  prizes?: string | null;
  status: TournamentStatus | string;
  modality?: TournamentModality | string;
  invite_token?: string | null;
  club_validation_status?: ClubValidationStatus | string;
  club_validated_at?: string | null;
  organizer_user_id?: string | null;
  photos?: { id: string; photo_url: string; caption?: string }[];
  dates?: TournamentDate[];
  approved_count?: number;
  pending_count?: number;
  total_count?: number;
  spots_left?: number | null;
}

export interface TournamentStanding {
  registrationId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  points: number;
  position: number;
}

export const TOURNAMENT_FORMATS: { value: string; label: string }[] = [
  { value: 'GROUPS_THEN_ELIMINATION', label: 'Zonas + eliminatoria' },
  { value: 'SINGLE_ELIMINATION', label: 'Eliminación directa' },
  { value: 'OPEN_COURT', label: 'Cancha abierta' },
];

// Categorías fijas de juego (de mayor a menor nivel).
export const FIXED_CATEGORY_OPTIONS = [
  '1ra',
  '2da',
  '3ra',
  '4ta',
  '5ta',
  '6ta',
  '7ma',
  '8va',
] as const;

export type FixedCategory = (typeof FIXED_CATEGORY_OPTIONS)[number];

/** @deprecated Prefer FIXED_CATEGORY_OPTIONS; se mantiene por compatibilidad. */
export const TOURNAMENT_CATEGORY_OPTIONS = FIXED_CATEGORY_OPTIONS;

export type TournamentCategory = FixedCategory | `Suma ${number}`;

export type TournamentCategoryMode = 'FIXED' | 'SUM';

export const SUM_CATEGORY_MIN = 3;
export const SUM_CATEGORY_MAX = 15;

export const SUM_CATEGORY_CAPS = Array.from(
  { length: SUM_CATEGORY_MAX - SUM_CATEGORY_MIN + 1 },
  (_, i) => SUM_CATEGORY_MIN + i,
) as readonly number[];

export type SumCategoryCap = number;

export const SUM_CATEGORY_OPTIONS = SUM_CATEGORY_CAPS.map(
  (cap) => `Suma ${cap}`,
) as readonly string[];

export function isSumCategoryCap(value: number): value is SumCategoryCap {
  return (
    Number.isInteger(value) &&
    value >= SUM_CATEGORY_MIN &&
    value <= SUM_CATEGORY_MAX
  );
}

export const CATEGORY_MODE_OPTIONS: { value: TournamentCategoryMode; label: string }[] = [
  { value: 'FIXED', label: 'Categoría' },
  { value: 'SUM', label: 'Suma' },
];

/** Ordinal usado en torneos por suma: 1ra=1 … 8va=8. */
const CATEGORY_ORDINAL: Record<string, number> = {
  '1ra': 1,
  '2da': 2,
  '3ra': 3,
  '4ta': 4,
  '5ta': 5,
  '6ta': 6,
  '7ma': 7,
  '8va': 8,
};

export function categoryOrdinal(category?: string | null): number | null {
  if (!category) return null;
  return CATEGORY_ORDINAL[category.trim()] ?? null;
}

export function parseSumCategoryCap(category?: string | null): number | null {
  if (!category) return null;
  const match = /^Suma\s+(\d+)$/i.exec(category.trim());
  if (!match) return null;
  const cap = Number(match[1]);
  return isSumCategoryCap(cap) ? cap : null;
}

export function getTournamentCategoryMode(
  category?: string | null,
): TournamentCategoryMode {
  return parseSumCategoryCap(category) != null ? 'SUM' : 'FIXED';
}

export function formatSumCategory(cap: number): string {
  return `Suma ${cap}`;
}

/** Pareja válida si la suma de ordinales es ≤ tope (regla habitual en padel). */
export function teamFitsSumCap(
  player1Category: string,
  player2Category: string,
  maxSum: number,
): boolean {
  const a = categoryOrdinal(player1Category);
  const b = categoryOrdinal(player2Category);
  if (a == null || b == null) return false;
  return a + b <= maxSum;
}

/**
 * Si el jugador puede participar en un torneo según la categoría publicada.
 * - Sin categoría en el torneo → abierto.
 * - Categoría fija → debe coincidir con la del jugador.
 * - Suma N → el ordinal del jugador debe admitir al menos un compañero válido (p + 1 ≤ N).
 */
export function playerFitsTournamentCategory(
  playerCategory?: string | null,
  tournamentCategory?: string | null,
): boolean {
  const tournamentCat = tournamentCategory?.trim();
  if (!tournamentCat) return true;

  const sumCap = parseSumCategoryCap(tournamentCat);
  if (sumCap != null) {
    const ordinal = categoryOrdinal(playerCategory);
    if (ordinal == null) return false;
    // Mejor pareja posible = 1ra (ordinal 1)
    return ordinal + 1 <= sumCap;
  }

  const playerCat = playerCategory?.trim();
  if (!playerCat) return false;
  return playerCat === tournamentCat;
}

export function teamSumOrdinal(
  player1Category: string,
  player2Category: string,
): number | null {
  const a = categoryOrdinal(player1Category);
  const b = categoryOrdinal(player2Category);
  if (a == null || b == null) return null;
  return a + b;
}

// Tipo / género del torneo
export const TOURNAMENT_TYPE_OPTIONS = ['Masculino', 'Femenino', 'Mixto'] as const;

export type TournamentType = (typeof TOURNAMENT_TYPE_OPTIONS)[number];

/** Modalidad de categorías en circuitos. */
export const CIRCUIT_CATEGORY_GENDER_OPTIONS = ['Caballeros', 'Damas'] as const;

export type CircuitCategoryGender = (typeof CIRCUIT_CATEGORY_GENDER_OPTIONS)[number];

export function formatCircuitCategory(label?: string | null, gender?: string | null): string {
  const parts = [label?.trim(), gender?.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Categoría';
}

export function formatTournamentCategory(
  category?: string | null,
  gender?: string | null,
): string {
  const parts = [category?.trim(), gender?.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Categoría abierta';
}

export const TOURNAMENT_MODALITY_OPTIONS: { value: TournamentModality; label: string }[] = [
  { value: 'INTERNAL', label: 'Interno' },
  { value: 'EXTERNAL', label: 'Externo' },
];

export function modalityLabel(modality?: string | null): string {
  return TOURNAMENT_MODALITY_OPTIONS.find((o) => o.value === modality)?.label || modality || 'Torneo';
}

export function clubValidationLabel(status?: string | null): string {
  switch (status) {
    case 'PENDING':
      return 'Esperando validación del club';
    case 'APPROVED':
      return 'Validado por el club';
    case 'REJECTED':
      return 'Rechazado por el club';
    default:
      return '';
  }
}

export function formatLabel(format?: string | null): string {
  return TOURNAMENT_FORMATS.find((f) => f.value === format)?.label || format || 'Torneo';
}

export function tournamentPrice(t: { price?: number | string | null }): number {
  if (t.price == null) return 0;
  return typeof t.price === 'string' ? Number(t.price) : t.price;
}
