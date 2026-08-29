import {
  COMPETITIVE_BASE_POINTS,
  computeCompetitiveMatchPoints,
} from './category-scoring.util';

describe('computeCompetitiveMatchPoints — victoria', () => {
  it('otorga X puntos contra rivales de nivel similar', () => {
    expect(computeCompetitiveMatchPoints(450, [440, 460], 'win')).toBe(COMPETITIVE_BASE_POINTS);
  });

  it('suma menos puntos contra rivales mucho más débiles (misma categoría)', () => {
    const easyWin = computeCompetitiveMatchPoints(900, [100, 300], 'win');
    const closeWin = computeCompetitiveMatchPoints(900, [800, 900], 'win');
    expect(easyWin).toBeLessThan(closeWin);
    expect(easyWin).toBe(60);
    expect(closeWin).toBe(190);
  });

  it('suma más puntos contra rivales de nivel superior', () => {
    expect(computeCompetitiveMatchPoints(400, [520, 540], 'win')).toBe(226);
  });

  it('no baja del mínimo en victoria muy fácil', () => {
    expect(computeCompetitiveMatchPoints(950, [50, 80], 'win')).toBe(50);
  });
});

describe('computeCompetitiveMatchPoints — derrota', () => {
  it('resta X puntos contra rivales de nivel similar', () => {
    expect(computeCompetitiveMatchPoints(450, [450, 450], 'loss')).toBe(
      -COMPETITIVE_BASE_POINTS,
    );
  });

  it('pierde más puntos contra rivales mucho más débiles', () => {
    const badLoss = computeCompetitiveMatchPoints(900, [100, 300], 'loss');
    const closeLoss = computeCompetitiveMatchPoints(900, [800, 900], 'loss');
    expect(badLoss).toBeLessThan(closeLoss);
    expect(badLoss).toBe(-340);
    expect(closeLoss).toBe(-210);
  });

  it('pierde menos puntos contra rivales de nivel superior', () => {
    expect(computeCompetitiveMatchPoints(400, [520, 540], 'loss')).toBe(-174);
  });
});

describe('computeCompetitiveMatchPoints — empate', () => {
  it('no modifica puntos', () => {
    expect(computeCompetitiveMatchPoints(450, [520, 380], 'draw')).toBe(0);
  });
});
