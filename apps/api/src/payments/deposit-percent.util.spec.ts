import { applyDepositPercent, normalizeDepositPercent } from './deposit-percent.util';

describe('deposit-percent.util', () => {
  it('normaliza el porcentaje', () => {
    expect(normalizeDepositPercent(25)).toBe(25);
    expect(normalizeDepositPercent(100)).toBe(100);
    expect(normalizeDepositPercent(150)).toBe(100);
    expect(normalizeDepositPercent(-10)).toBe(0);
    expect(normalizeDepositPercent('50')).toBe(50);
    expect(normalizeDepositPercent(undefined)).toBe(100);
  });

  it('aplica seña sobre la parte del jugador', () => {
    expect(applyDepositPercent(10000, 100)).toBe(10000);
    expect(applyDepositPercent(10000, 50)).toBe(5000);
    expect(applyDepositPercent(10000, 25)).toBe(2500);
    expect(applyDepositPercent(9999, 25)).toBe(2499.75);
    expect(applyDepositPercent(0, 50)).toBe(0);
  });
});
