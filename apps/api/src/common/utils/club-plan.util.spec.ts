import {
  applyPointsMultiplier,
  getPromotionMultiplier,
  MAX_PROMOTION_MULTIPLIER,
} from './club-plan.util';

describe('club-plan.util', () => {
  it('mapea planes a multiplicador', () => {
    expect(getPromotionMultiplier('GROWTH')).toBe(1.5);
    expect(getPromotionMultiplier('PRO')).toBe(3);
    expect(getPromotionMultiplier('BASIC')).toBe(1);
  });

  it('el multiplicador de promo no supera 3.0', () => {
    expect(MAX_PROMOTION_MULTIPLIER).toBe(3);
    expect(getPromotionMultiplier('PRO')).toBeLessThanOrEqual(MAX_PROMOTION_MULTIPLIER);
    expect(applyPointsMultiplier(10, 5)).toBe(30);
    expect(applyPointsMultiplier(10, 3)).toBe(30);
  });

  it('redondea puntos con multiplicador', () => {
    expect(applyPointsMultiplier(10, 1.5)).toBe(15);
    expect(applyPointsMultiplier(10, 3)).toBe(30);
  });
});
