export type TournamentStatus =
  | 'DRAFT'
  | 'OPEN_REGISTRATION'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'CANCELLED';

/**
 * Terminado: FINISHED o vencido el margen para cargar resultados (48 h después
 * del último día). No admite gestión.
 */
export function isTournamentClosed(t?: {
  status?: string | null;
  is_closed?: boolean | null;
  isClosed?: boolean | null;
} | null): boolean {
  if (!t) return false;
  return t.status === 'FINISHED' || !!t.is_closed || !!t.isClosed;
}

export type TournamentModality = 'INTERNAL' | 'EXTERNAL';
export type TournamentScheduleType = 'SINGLE_DAY' | 'MULTI_DAY';
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
  /** Motivo por el que el organizador tiene que validar la categoría de la pareja (circuitos). */
  category_review?: string | null;
  circuit_player1_id?: string | null;
  circuit_player2_id?: string | null;
  created_at: string;
}

export type TournamentPlayerSide = 'DRIVE' | 'REVES';

/** Jugador de un torneo interno, ubicado en la columna drive o revés. */
export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  user_id?: string | null;
  name: string;
  side: TournamentPlayerSide;
  registration_id?: string | null;
  photo_url?: string | null;
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
  score?: {
    sets: { teamA: number; teamB: number }[];
    setsA?: number;
    setsB?: number;
    bye?: boolean;
    walkover?: boolean;
  } | null;
  winner_registration_id?: string | null;
  next_match_id?: string | null;
  next_slot?: 'A' | 'B' | null;
  bracket_position?: number | null;
  scheduled_at?: string | null;
  /** GROUP = partido de zona, KNOCKOUT = cuadro eliminatorio; null en ligas o partidos sueltos. */
  phase?: 'GROUP' | 'KNOCKOUT' | null;
  /** Origen del lugar en el cuadro: "GROUP:A:1" (1° Zona A) o "BYE". */
  team_a_source?: string | null;
  team_b_source?: string | null;
}

export type FixtureMode = 'GROUPS_THEN_ELIMINATION' | 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' | 'OPEN_COURT';

export interface TournamentGroupStanding extends TournamentStanding {
  gamesWon: number;
  gamesLost: number;
  walkoverLosses: number;
  qualified: boolean;
}

export interface TournamentGroup {
  code: string;
  complete: boolean;
  /** Cerrada a mano por el organizador (partidos sin jugar cancelados). */
  closedManually?: boolean;
  played?: number;
  total?: number;
  standings: TournamentGroupStanding[];
  matches: TournamentMatch[];
}

export interface TournamentGroupsResponse {
  qualifiersPerGroup: number;
  groups: TournamentGroup[];
}

/** Zonas antes de generar los partidos: propuesta por ranking o armadas a mano. */
export interface ZoneDraft {
  saved: boolean;
  teams: number;
  fixtureMatches: number;
  groupMatches: number;
  playedMatches: number;
  error?: string | null;
  groups: { code: string; teams: { id: string; name: string; seed: number | null }[] }[];
}

/** En torneos internos cada enfrentamiento es un "Partido N" (no una fecha/jornada). */
export function tournamentMatchLabel(
  match: Pick<TournamentMatch, 'round' | 'round_label'>,
  modality?: string | null,
): string {
  const label = match.round_label?.trim();
  if (modality === 'INTERNAL') {
    return label ? label.replace(/^Fecha\s+(\d+)$/i, 'Partido $1') : `Partido ${match.round}`;
  }
  return label || `Ronda ${match.round}`;
}

export function nextInternalMatchNumber(matches: Pick<TournamentMatch, 'round'>[]): number {
  return matches.reduce((max, m) => Math.max(max, Number(m.round) || 0), 0) + 1;
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
  accept_transfer?: boolean;
  accept_mercadopago?: boolean;
  transfer_cbu?: string | null;
  transfer_alias?: string | null;
  transfer_holder_name?: string | null;
  refund_on_withdraw?: boolean;
  rules?: string | null;
  prizes?: string | null;
  status: TournamentStatus | string;
  modality?: TournamentModality | string;
  invite_token?: string | null;
  club_validation_status?: ClubValidationStatus | string;
  club_validated_at?: string | null;
  schedule_type?: TournamentScheduleType | string;
  organizer_user_id?: string | null;
  organizer_name?: string | null;
  organizer_nickname?: string | null;
  organizer_email?: string | null;
  organizer_photo_url?: string | null;
  organizer_display_name?: string | null;
  photos?: { id: string; photo_url: string; caption?: string }[];
  dates?: TournamentDate[];
  venues?: {
    club_id: string;
    club_name?: string | null;
    is_primary?: boolean;
    sort_order?: number;
  }[];
  venue_count?: number;
  approved_count?: number;
  pending_count?: number;
  total_count?: number;
  spots_left?: number | null;
  is_past?: boolean;
  is_closed?: boolean;
  circuit_id?: string | null;
  circuit_category_id?: string | null;
  /** Cierre programado de la inscripción. */
  registration_closes_at?: string | null;
  /** "Cerrar definitivamente": cierre manual de la inscripción. */
  registration_closed_at?: string | null;
  registration_closed?: boolean;
  /** El usuario actual puede gestionar el torneo (organizador, admin del club o staff del circuito). */
  viewer_can_manage?: boolean;
}

/** "Restan 3 días", "Cierra hoy 20:00", "Inscripción cerrada"; null si no hay cierre. */
export function registrationCountdown(
  t: Pick<TournamentDetail, 'registration_closes_at' | 'registration_closed_at' | 'registration_closed'>,
  now = Date.now(),
): { label: string; closed: boolean; urgent: boolean } | null {
  if (t.registration_closed || t.registration_closed_at) {
    return { label: 'Inscripción cerrada', closed: true, urgent: false };
  }
  if (!t.registration_closes_at) return null;
  const closesAt = new Date(t.registration_closes_at);
  const diff = closesAt.getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return { label: 'Inscripción cerrada', closed: true, urgent: false };
  const time = closesAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((closesAt.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days <= 0) return { label: `Cierra hoy ${time}`, closed: false, urgent: true };
  if (days === 1) return { label: `Cierra mañana ${time}`, closed: false, urgent: true };
  return { label: `Restan ${days} días`, closed: false, urgent: false };
}

/** Horas de anticipación (respecto de la primera jornada) para que la baja tenga devolución. */
export const WITHDRAW_REFUND_NOTICE_HOURS = 24;

export function tournamentStartsAt(t: Pick<TournamentDetail, 'dates' | 'start_date'>): Date | null {
  const times = (t.dates ?? [])
    .map((d) => new Date(d.play_date).getTime())
    .filter((ms) => !Number.isNaN(ms));
  if (t.start_date) {
    const ms = new Date(t.start_date).getTime();
    if (!Number.isNaN(ms)) times.push(ms);
  }
  return times.length ? new Date(Math.min(...times)) : null;
}

/** true si la pareja todavía puede bajarse con devolución de la inscripción. */
export function isWithdrawRefundable(t: Pick<TournamentDetail, 'dates' | 'start_date' | 'refund_on_withdraw'>) {
  if (t.refund_on_withdraw === false) return false;
  const startsAt = tournamentStartsAt(t);
  if (!startsAt) return false;
  return startsAt.getTime() - Date.now() >= WITHDRAW_REFUND_NOTICE_HOURS * 60 * 60 * 1000;
}

export type WithdrawRefundResult = {
  status: 'NONE' | 'REFUNDED' | 'PENDING' | 'RETAINED';
  amount: number;
  reason?: 'NOT_PAID' | 'POLICY_DISABLED' | 'TOO_LATE';
};

export interface TournamentRefund {
  id: string;
  tournament_id: string;
  registration_id?: string | null;
  user_id?: string | null;
  player1_name: string;
  player2_name: string;
  phone?: string | null;
  amount: number | string;
  currency?: string;
  provider?: string | null;
  status: 'PENDING' | 'REFUNDED';
  created_at: string;
  refunded_at?: string | null;
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

export const TOURNAMENT_SCHEDULE_OPTIONS: {
  value: TournamentScheduleType;
  label: string;
  hint: string;
}[] = [
    {
      value: 'SINGLE_DAY',
      label: 'Un día',
      hint: '',
    },
    {
      value: 'MULTI_DAY',
      label: 'Largo',
      hint: 'Varias jornadas: el organizador puede ir agregando fechas.',
    },
  ];

export function scheduleTypeLabel(scheduleType?: string | null): string {
  return TOURNAMENT_SCHEDULE_OPTIONS.find((o) => o.value === scheduleType)?.label || '';
}

export function isSingleDaySchedule(scheduleType?: string | null): boolean {
  return scheduleType !== 'MULTI_DAY';
}

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

/** Nombre visible del organizador (nickname > name > email). */
export function tournamentOrganizerLabel(t: {
  organizer_display_name?: string | null;
  organizer_nickname?: string | null;
  organizer_name?: string | null;
  organizer_email?: string | null;
  organizerDisplayName?: string | null;
  organizerNickname?: string | null;
  organizerName?: string | null;
  organizerEmail?: string | null;
}): string | null {
  const label =
    t.organizer_display_name ||
    t.organizerDisplayName ||
    t.organizer_nickname ||
    t.organizerNickname ||
    t.organizer_name ||
    t.organizerName ||
    t.organizer_email ||
    t.organizerEmail ||
    null;
  const trimmed = typeof label === 'string' ? label.trim() : '';
  return trimmed || null;
}

export function formatLabel(format?: string | null): string {
  return TOURNAMENT_FORMATS.find((f) => f.value === format)?.label || format || 'Torneo';
}

export function tournamentPrice(t: { price?: number | string | null }): number {
  if (t.price == null) return 0;
  return typeof t.price === 'string' ? Number(t.price) : t.price;
}

export function tournamentPaymentMethods(t: {
  accept_transfer?: boolean | null;
  accept_mercadopago?: boolean | null;
}): { transfer: boolean; mercadopago: boolean } {
  const transfer = Boolean(t.accept_transfer);
  const mercadopago = Boolean(t.accept_mercadopago);
  if (transfer || mercadopago) return { transfer, mercadopago };
  return { transfer: false, mercadopago: true };
}

export function tournamentPaymentMethodsLabel(t: {
  accept_transfer?: boolean | null;
  accept_mercadopago?: boolean | null;
}): string {
  const { transfer, mercadopago } = tournamentPaymentMethods(t);
  if (transfer && mercadopago) return 'Transferencia o Mercado Pago';
  if (transfer) return 'Transferencia';
  return 'Mercado Pago';
}
