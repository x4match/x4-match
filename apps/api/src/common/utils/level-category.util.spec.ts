import { getLevelCategory, getCategoryRatingRange, ALL_CATEGORIES } from './level-category.util';

describe('getLevelCategory', () => {
  it('debería retornar "1ra" para rating >= 2000', () => {
    expect(getLevelCategory(2000)).toBe('1ra');
    expect(getLevelCategory(2500)).toBe('1ra');
  });

  it('debería retornar "2da" para rating 1700-1999', () => {
    expect(getLevelCategory(1700)).toBe('2da');
    expect(getLevelCategory(1999)).toBe('2da');
  });

  it('debería retornar "3ra" para rating 1400-1699', () => {
    expect(getLevelCategory(1400)).toBe('3ra');
    expect(getLevelCategory(1699)).toBe('3ra');
  });

  it('debería retornar "4ta" para rating 1200-1399', () => {
    expect(getLevelCategory(1200)).toBe('4ta');
    expect(getLevelCategory(1399)).toBe('4ta');
  });

  it('debería retornar "5ta" para rating 1000-1199', () => {
    expect(getLevelCategory(1000)).toBe('5ta');
    expect(getLevelCategory(1199)).toBe('5ta');
  });

  it('debería retornar "6ta" para rating 800-999', () => {
    expect(getLevelCategory(800)).toBe('6ta');
    expect(getLevelCategory(999)).toBe('6ta');
  });

  it('debería retornar "7ma" para rating 600-799', () => {
    expect(getLevelCategory(600)).toBe('7ma');
    expect(getLevelCategory(799)).toBe('7ma');
  });

  it('debería retornar "8va" para rating < 600', () => {
    expect(getLevelCategory(0)).toBe('8va');
    expect(getLevelCategory(599)).toBe('8va');
  });
});

describe('getCategoryRatingRange', () => {
  it('debería retornar rangos correctos para cada categoría', () => {
    expect(getCategoryRatingRange('1ra')).toEqual({ min: 2000, max: 9999 });
    expect(getCategoryRatingRange('2da')).toEqual({ min: 1700, max: 1999 });
    expect(getCategoryRatingRange('3ra')).toEqual({ min: 1400, max: 1699 });
    expect(getCategoryRatingRange('4ta')).toEqual({ min: 1200, max: 1399 });
    expect(getCategoryRatingRange('5ta')).toEqual({ min: 1000, max: 1199 });
    expect(getCategoryRatingRange('6ta')).toEqual({ min: 800, max: 999 });
    expect(getCategoryRatingRange('7ma')).toEqual({ min: 600, max: 799 });
    expect(getCategoryRatingRange('8va')).toEqual({ min: 0, max: 599 });
  });

  it('debería retornar rango completo para categoría desconocida', () => {
    expect(getCategoryRatingRange('unknown')).toEqual({ min: 0, max: 9999 });
  });

  it('la categoría derivada del rating coincide con el rango inverso', () => {
    for (const cat of ALL_CATEGORIES) {
      const range = getCategoryRatingRange(cat);
      expect(getLevelCategory(range.min)).toBe(cat);
    }
  });
});

describe('ALL_CATEGORIES', () => {
  it('debería contener 8 categorías', () => {
    expect(ALL_CATEGORIES).toHaveLength(8);
  });

  it('debería estar ordenado de mayor a menor', () => {
    expect(ALL_CATEGORIES).toEqual(['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va']);
  });
});
