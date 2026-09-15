import {
  assertRewardRedeemable,
  generateRedemptionCode,
} from './club-rewards.util';

describe('generateRedemptionCode', () => {
  it('genera formato X4-XXXXXX', () => {
    let i = 0;
    const code = generateRedemptionCode(() => {
      const seq = i;
      i += 1;
      return seq;
    });
    expect(code).toMatch(/^X4-[A-Z0-9]{6}$/);
    expect(code.length).toBe(9);
  });
});

describe('assertRewardRedeemable', () => {
  const base = {
    active: true,
    stock: null as number | null,
    maxPerUser: null as number | null,
    userRedemptionCount: 0,
    balance: 200,
    pointsRequired: 100,
  };

  it('permite canje válido', () => {
    expect(() => assertRewardRedeemable(base)).not.toThrow();
  });

  it('bloquea sin stock', () => {
    expect(() => assertRewardRedeemable({ ...base, stock: 0 })).toThrow('SIN_STOCK');
  });

  it('bloquea cupo excedido', () => {
    expect(() =>
      assertRewardRedeemable({ ...base, maxPerUser: 1, userRedemptionCount: 1 }),
    ).toThrow('CUPO_EXCEDIDO');
  });

  it('bloquea saldo insuficiente', () => {
    expect(() => assertRewardRedeemable({ ...base, balance: 50 })).toThrow('SALDO_INSUFICIENTE');
  });

  it('bloquea premio inactivo', () => {
    expect(() => assertRewardRedeemable({ ...base, active: false })).toThrow('PREMIO_INACTIVO');
  });
});
