import {
  getCategorySearchRange,
  isCategoryWithinSearchSteps,
  shiftCategoryStronger,
  shiftCategoryWeaker,
  resolveMatchLevelBand,
} from './level-range.util';

describe('shiftCategoryStronger / Weaker', () => {
  it('sube y baja con clamp en extremos', () => {
    expect(shiftCategoryStronger('5ta', 2)).toBe('3ra');
    expect(shiftCategoryWeaker('5ta', 2)).toBe('7ma');
    expect(shiftCategoryStronger('1ra', 2)).toBe('1ra');
    expect(shiftCategoryWeaker('8va', 2)).toBe('8va');
  });
});

describe('getCategorySearchRange', () => {
  it('une ±1 categoría para 5ta → 6ta–4ta', () => {
    expect(getCategorySearchRange('5ta')).toEqual({ min: 280, max: 639 });
  });

  it('clampa en 8va (solo hacia arriba)', () => {
    expect(getCategorySearchRange('8va')).toEqual({ min: 0, max: 279 });
  });

  it('clampa en 1ra (solo hacia abajo)', () => {
    expect(getCategorySearchRange('1ra')).toEqual({ min: 760, max: 1000 });
  });
});

describe('isCategoryWithinSearchSteps', () => {
  it('permite hasta ±1', () => {
    expect(isCategoryWithinSearchSteps('5ta', '4ta')).toBe(true);
    expect(isCategoryWithinSearchSteps('5ta', '6ta')).toBe(true);
    expect(isCategoryWithinSearchSteps('5ta', '3ra')).toBe(false);
    expect(isCategoryWithinSearchSteps('5ta', '7ma')).toBe(false);
  });
});

describe('resolveMatchLevelBand', () => {
  it('usa ±1 por defecto', () => {
    expect(resolveMatchLevelBand({ category: '5ta' })).toEqual({ min: 280, max: 639 });
  });

  it('en mixtos mujer une equivalencia damas↔caballeros con la banda ±1', () => {
    const band = resolveMatchLevelBand({ category: '5ta', femaleMixed: true });
    // search ±1: 280–639; mixed −2: 160–519 → unión 160–639
    expect(band.min).toBe(160);
    expect(band.max).toBe(639);
  });
});
