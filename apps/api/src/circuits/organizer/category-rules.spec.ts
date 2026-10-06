import {
  checkTeamEligibility,
  levelFromRating,
  parseCategoryLabel,
  suggestLevelChange,
} from './category-rules';

describe('category-rules', () => {
  it.each([
    ['4ta', { kind: 'FIXED', level: 4, sumTotal: null }],
    ['7°', { kind: 'FIXED', level: 7, sumTotal: null }],
    ['Damas 6ta', { kind: 'FIXED', level: 6, sumTotal: null }],
    ['Suma 07', { kind: 'SUM', level: null, sumTotal: 7 }],
    ['Damas SUMA 13', { kind: 'SUM', level: null, sumTotal: 13 }],
    ['Libre', { kind: 'OPEN', level: null, sumTotal: null }],
    ['Suma 1', { kind: 'OPEN', level: null, sumTotal: null }],
    ['40+', { kind: 'OPEN', level: null, sumTotal: null }],
  ])('interpreta "%s"', (label, expected) => {
    expect(parseCategoryLabel(label)).toEqual(expected);
  });

  it('deriva el nivel desde el rating de x4match', () => {
    expect(levelFromRating(2100)).toBe(1);
    expect(levelFromRating(1250)).toBe(4);
    expect(levelFromRating(100)).toBe(8);
    expect(levelFromRating(null)).toBeNull();
  });

  it('categoría fija: se puede jugar para arriba, no para abajo', () => {
    const cuarta = parseCategoryLabel('4ta');
    expect(checkTeamEligibility(cuarta, [4, 6]).status).toBe('OK');
    const blocked = checkTeamEligibility(cuarta, [3, 5], ['Ana', 'Bea']);
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.status === 'BLOCKED' && blocked.reason).toMatch(/Ana es de una categoría superior/);
  });

  it('suma: la pareja tiene que sumar al menos N', () => {
    const suma7 = parseCategoryLabel('Suma 7');
    expect(checkTeamEligibility(suma7, [3, 4]).status).toBe('OK');
    expect(checkTeamEligibility(suma7, [4, 5]).status).toBe('OK');
    expect(checkTeamEligibility(suma7, [2, 4]).status).toBe('BLOCKED');
  });

  it('sin categoría queda para validar; categoría libre no controla', () => {
    expect(checkTeamEligibility(parseCategoryLabel('5ta'), [5, null]).status).toBe('REVIEW');
    expect(checkTeamEligibility(parseCategoryLabel('Libre'), [null, null]).status).toBe('OK');
  });

  it('sugiere ascensos arriba y descensos abajo', () => {
    expect(suggestLevelChange(5, 1, 20, 2, 2)).toEqual({ direction: 'PROMOTION', toLevel: 4 });
    expect(suggestLevelChange(5, 20, 20, 2, 2)).toEqual({ direction: 'RELEGATION', toLevel: 6 });
    expect(suggestLevelChange(5, 10, 20, 2, 2)).toBeNull();
    expect(suggestLevelChange(1, 1, 20, 2, 2)).toBeNull();
    expect(suggestLevelChange(8, 20, 20, 2, 2)).toBeNull();
    expect(suggestLevelChange(5, 3, 4, 2, 2)).toBeNull();
  });
});
