export type ClubSubscriptionPlan = 'BASIC' | 'GROWTH' | 'PRO';

/** Default de boost en horario valle (sin planes). */
export const DEFAULT_PROMOTION_MULTIPLIER = 2;

/** Tope duro del multiplicador de puntos canjeables en promo. */
export const MAX_PROMOTION_MULTIPLIER = 2.5;

/**
 * @deprecated Los planes ya no definen el multiplicador de puntos.
 * Se mantiene por compatibilidad; usar DEFAULT_PROMOTION_MULTIPLIER / clampPromotionMultiplier.
 */
export const PROMOTION_MULTIPLIER_BY_PLAN: Record<ClubSubscriptionPlan, number> = {
  BASIC: DEFAULT_PROMOTION_MULTIPLIER,
  GROWTH: DEFAULT_PROMOTION_MULTIPLIER,
  PRO: DEFAULT_PROMOTION_MULTIPLIER,
};

/** Acota el multiplicador de una promoción al rango [1, 2.5]. */
export function clampPromotionMultiplier(value: number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PROMOTION_MULTIPLIER;
  return Math.min(Math.max(n, 1), MAX_PROMOTION_MULTIPLIER);
}

/**
 * @deprecated No usar el plan del club. Preferir `clampPromotionMultiplier` con el valor de la promo.
 */
export function getPromotionMultiplier(_plan?: string | null | undefined): number {
  return DEFAULT_PROMOTION_MULTIPLIER;
}

export function applyPointsMultiplier(basePoints: number, multiplier: number): number {
  const capped = clampPromotionMultiplier(multiplier);
  return Math.round(basePoints * capped);
}
