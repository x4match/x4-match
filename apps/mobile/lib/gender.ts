export type MatchGender = 'male' | 'female' | 'mixed' | 'open';
export type BinaryGender = 'male' | 'female';

export const MATCH_GENDER_OPTIONS: { value: MatchGender; label: string }[] = [
  { value: 'male', label: 'Caballeros' },
  { value: 'female', label: 'Damas' },
  { value: 'mixed', label: 'Mixto' },
];

export const MATCH_GENDER_OPTIONS_WITH_OPEN: { value: MatchGender; label: string }[] = [
  ...MATCH_GENDER_OPTIONS,
  { value: 'open', label: 'Abierto' },
];

/** Normaliza género de perfil (ES/EN) a male/female. */
export function normalizeBinaryGender(value?: string | null): BinaryGender | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (['male', 'masculino', 'hombre', 'm', 'caballeros'].includes(v)) return 'male';
  if (['female', 'femenino', 'mujer', 'f', 'damas'].includes(v)) return 'female';
  return null;
}

export function defaultMatchGenderFromUser(
  selfGender?: string | null,
  mode?: 'friendly' | 'competitive',
): MatchGender {
  if (mode === 'friendly') return 'open';
  const self = normalizeBinaryGender(selfGender);
  if (self === 'female') return 'female';
  if (self === 'male') return 'male';
  return 'open';
}

/**
 * Si el creador y el compañero tienen género binario opuesto → mixto.
 * En cualquier otro caso mantiene `fallback`.
 */
export function resolveMatchGenderFromPartner(
  selfGender?: string | null,
  partnerGender?: string | null,
  fallback: MatchGender = 'open',
): MatchGender {
  const self = normalizeBinaryGender(selfGender);
  const partner = normalizeBinaryGender(partnerGender);
  if (self && partner && self !== partner) return 'mixed';
  return fallback;
}
