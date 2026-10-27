export type ClubSubscriptionPlan = 'BASIC' | 'GROWTH' | 'PRO';

/** Tope duro del multiplicador de puntos canjeables en promo. */
export const MAX_PROMOTION_MULTIPLIER = 3;

/** Multiplicador de puntos en horarios con promoción activa, según plan del club. */
export const PROMOTION_MULTIPLIER_BY_PLAN: Record<ClubSubscriptionPlan, number> = {
  BASIC: 1,
  GROWTH: 1.5,
  PRO: 3,
};

export function getPromotionMultiplier(plan: string | null | undefined): number {
  const key = (plan ?? 'BASIC') as ClubSubscriptionPlan;
  const raw = PROMOTION_MULTIPLIER_BY_PLAN[key] ?? 1;
  return Math.min(Math.max(raw, 1), MAX_PROMOTION_MULTIPLIER);
}

export function applyPointsMultiplier(basePoints: number, multiplier: number): number {
  const capped = Math.min(Math.max(multiplier, 0), MAX_PROMOTION_MULTIPLIER);
  return Math.round(basePoints * capped);
}
