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
  it('une ±2 categorías para 5ta → 7ma–3ra', () => {
    expect(getCategorySearchRange('5ta')).toEqual({ min: 160, max: 759 });
  });

  it('clampa en 8va (solo hacia arriba)', () => {
    expect(getCategorySearchRange('8va')).toEqual({ min: 0, max: 399 });
  });

  it('clampa en 1ra (solo hacia abajo)', () => {
    expect(getCategorySearchRange('1ra')).toEqual({ min: 640, max: 1000 });
  });
});

describe('isCategoryWithinSearchSteps', () => {
  it('permite hasta ±2', () => {
    expect(isCategoryWithinSearchSteps('5ta', '3ra')).toBe(true);
    expect(isCategoryWithinSearchSteps('5ta', '7ma')).toBe(true);
    expect(isCategoryWithinSearchSteps('5ta', '2da')).toBe(false);
    expect(isCategoryWithinSearchSteps('5ta', '8va')).toBe(false);
  });
});

describe('resolveMatchLevelBand', () => {
  it('usa ±2 por defecto', () => {
    expect(resolveMatchLevelBand({ category: '5ta' })).toEqual({ min: 160, max: 759 });
  });

  it('en mixtos mujer no estrecha la banda ±2', () => {
    const band = resolveMatchLevelBand({ category: '5ta', femaleMixed: true });
    expect(band.min).toBe(160);
    expect(band.max).toBe(759);
  });
});
