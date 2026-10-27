import {
  applyPointsMultiplier,
  clampPromotionMultiplier,
  DEFAULT_PROMOTION_MULTIPLIER,
  getPromotionMultiplier,
  MAX_PROMOTION_MULTIPLIER,
} from './club-plan.util';

describe('club-plan.util', () => {
  it('no usa planes: getPromotionMultiplier siempre devuelve el default', () => {
    expect(getPromotionMultiplier('BASIC')).toBe(DEFAULT_PROMOTION_MULTIPLIER);
    expect(getPromotionMultiplier('GROWTH')).toBe(DEFAULT_PROMOTION_MULTIPLIER);
    expect(getPromotionMultiplier('PRO')).toBe(DEFAULT_PROMOTION_MULTIPLIER);
  });

  it('acota el multiplicador de promo entre 1 y 3', () => {
    expect(MAX_PROMOTION_MULTIPLIER).toBe(3);
    expect(clampPromotionMultiplier(1.5)).toBe(1.5);
    expect(clampPromotionMultiplier(2)).toBe(2);
    expect(clampPromotionMultiplier(3)).toBe(3);
    expect(clampPromotionMultiplier(5)).toBe(3);
    expect(clampPromotionMultiplier(0)).toBe(1);
    expect(clampPromotionMultiplier(undefined)).toBe(DEFAULT_PROMOTION_MULTIPLIER);
  });

  it('redondea puntos con multiplicador capado a 3.0', () => {
    expect(applyPointsMultiplier(10, 1.5)).toBe(15);
    expect(applyPointsMultiplier(10, 2)).toBe(20);
    expect(applyPointsMultiplier(10, 3)).toBe(30);
    expect(applyPointsMultiplier(10, 5)).toBe(30);
  });
});
