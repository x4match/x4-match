export type ClubSubscriptionPlan = 'BASIC' | 'GROWTH' | 'PRO';

/** Multiplicador de puntos en horarios con promoción activa, según plan del club. */
export const PROMOTION_MULTIPLIER_BY_PLAN: Record<ClubSubscriptionPlan, number> = {
  BASIC: 1,
  GROWTH: 1.5,
  PRO: 2,
};

export function getPromotionMultiplier(plan: string | null | undefined): number {
  const key = (plan ?? 'BASIC') as ClubSubscriptionPlan;
  return PROMOTION_MULTIPLIER_BY_PLAN[key] ?? 1;
}

export function applyPointsMultiplier(basePoints: number, multiplier: number): number {
  return Math.round(basePoints * multiplier);
}
