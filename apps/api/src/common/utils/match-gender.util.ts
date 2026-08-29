export type MatchGender = 'male' | 'female' | 'mixed' | 'open';
export type BinaryGender = 'male' | 'female';

export function normalizeBinaryGender(value?: string | null): BinaryGender | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (['male', 'masculino', 'hombre', 'm'].includes(v)) return 'male';
  if (['female', 'femenino', 'mujer', 'f'].includes(v)) return 'female';
  return null;
}

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
