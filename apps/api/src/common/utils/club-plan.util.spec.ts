import { applyPointsMultiplier, getPromotionMultiplier } from './club-plan.util';

describe('club-plan.util', () => {
  it('mapea planes a multiplicador', () => {
    expect(getPromotionMultiplier('GROWTH')).toBe(1.5);
    expect(getPromotionMultiplier('PRO')).toBe(2);
    expect(getPromotionMultiplier('BASIC')).toBe(1);
  });

  it('redondea puntos con multiplicador', () => {
    expect(applyPointsMultiplier(10, 1.5)).toBe(15);
    expect(applyPointsMultiplier(10, 2)).toBe(20);
  });
});
