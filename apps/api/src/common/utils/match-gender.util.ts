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

/** Valida sexo del jugador contra género del partido (male/female/mixed/open). */
export function playerFitsMatchGender(
  matchGender?: string | null,
  playerGender?: string | null,
): { ok: true } | { ok: false; reason: string } {
  const match = (matchGender || 'open').trim().toLowerCase();
  if (!match || match === 'open') return { ok: true };

  const player = normalizeBinaryGender(playerGender);
  if (!player) {
    return { ok: false, reason: 'Completá tu sexo en el perfil para unirte a este partido' };
  }
  if (match === 'male' && player !== 'male') {
    return { ok: false, reason: 'Este partido es solo para hombres' };
  }
  if (match === 'female' && player !== 'female') {
    return { ok: false, reason: 'Este partido es solo para mujeres' };
  }
  return { ok: true };
}
