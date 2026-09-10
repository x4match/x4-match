export type CourtPosition = 'drive' | 'reves' | 'ambos' | null | undefined;

/** Compañero válido: lado opuesto, o alguno `ambos`, o sin dato (elige a mano). */
export function positionsAreCompatible(anchor: CourtPosition, partner: CourtPosition): boolean {
  const a = normalizePosition(anchor);
  const p = normalizePosition(partner);
  if (!a || !p) return true;
  if (a === 'ambos' || p === 'ambos') return true;
  return a !== p;
}

export function oppositePosition(position: CourtPosition): 'drive' | 'reves' | null {
  const p = normalizePosition(position);
  if (p === 'drive') return 'reves';
  if (p === 'reves') return 'drive';
  return null;
}

export function normalizePosition(value: CourtPosition): 'drive' | 'reves' | 'ambos' | null {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'drive') return 'drive';
  if (v === 'reves' || v === 'revés') return 'reves';
  if (v === 'ambos' || v === 'both') return 'ambos';
  return null;
}

export const INTERCLUB_WIN_POINTS = 300;
export const INTERCLUB_PLAY_POINTS = 50;
export const CHALLENGE_EXPIRY_HOURS = 72;
export const CHALLENGE_COOLDOWN_DAYS = 7;
export const PARTNER_CANDIDATE_LIMIT = 20;
