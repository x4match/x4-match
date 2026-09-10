import {
  COMPETITIVE_BASE_POINTS,
  computeCategoryDelta,
  computeCompetitiveMatchPoints,
  getCompetitiveBasePointsForDelta,
} from './category-scoring.util';

describe('computeCategoryDelta', () => {
  it('es 0 con rivales de la misma categoría', () => {
    expect(computeCategoryDelta('5ta', ['5ta', '5ta'])).toBe(0);
  });

  it('es +1 con rivales una categoría más fuertes', () => {
    expect(computeCategoryDelta('5ta', ['4ta', '4ta'])).toBe(1);
  });

  it('es −2 con rivales dos categorías más débiles', () => {
    expect(computeCategoryDelta('5ta', ['7ma', '7ma'])).toBe(-2);
  });

  it('redondea el promedio de rivales mixtos', () => {
    // (4ta=4 + 5ta=3) / 2 = 3.5 → 4 → Δ = 4 − 3 = +1
    expect(computeCategoryDelta('5ta', ['4ta', '5ta'])).toBe(1);
  });
});

describe('computeCompetitiveMatchPoints — victoria', () => {
  it('otorga base contra rivales de la misma categoría', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['5ta', '5ta'], 'win')).toBe(
      COMPETITIVE_BASE_POINTS,
    );
  });

  it('suma más contra rivales una cat arriba', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['4ta', '4ta'], 'win')).toBe(120);
  });

  it('suma aún más contra rivales dos o más cat arriba', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['3ra', '3ra'], 'win')).toBe(140);
    expect(computeCompetitiveMatchPoints('5ta', ['2da', '2da'], 'win')).toBe(140);
  });

  it('suma menos contra rivales una cat abajo', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['6ta', '6ta'], 'win')).toBe(60);
  });

  it('suma el mínimo contra rivales dos o más cat abajo', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['7ma', '7ma'], 'win')).toBe(30);
    expect(computeCompetitiveMatchPoints('5ta', ['8va', '8va'], 'win')).toBe(30);
  });
});

describe('computeCompetitiveMatchPoints — derrota', () => {
  it('resta base contra rivales de la misma categoría', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['5ta', '5ta'], 'loss')).toBe(
      -COMPETITIVE_BASE_POINTS,
    );
  });

  it('pierde menos contra rivales más fuertes', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['4ta', '4ta'], 'loss')).toBe(-60);
    expect(computeCompetitiveMatchPoints('5ta', ['3ra', '3ra'], 'loss')).toBe(-40);
  });

  it('pierde más contra rivales más débiles', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['6ta', '6ta'], 'loss')).toBe(-140);
    expect(computeCompetitiveMatchPoints('5ta', ['7ma', '7ma'], 'loss')).toBe(-175);
  });
});

describe('computeCompetitiveMatchPoints — empate', () => {
  it('no modifica puntos', () => {
    expect(computeCompetitiveMatchPoints('5ta', ['4ta', '6ta'], 'draw')).toBe(0);
  });
});

describe('getCompetitiveBasePointsForDelta', () => {
  it('devuelve la magnitud win de la fila', () => {
    expect(getCompetitiveBasePointsForDelta(0)).toBe(100);
    expect(getCompetitiveBasePointsForDelta(1)).toBe(120);
    expect(getCompetitiveBasePointsForDelta(-2)).toBe(30);
  });
});
