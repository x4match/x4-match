import {
  isPlacementComplete,
  normalizeCategoryStatus,
  resolveVisibleLevelCategory,
} from './placement.util';
import {
  PLACEMENT_INITIAL_RATING,
  PLACEMENT_MATCHES_REQUIRED,
  ratingToSkillScore,
} from './player-rating.util';

describe('placement.util', () => {
  it('arranca en skill 0 con el rating de nivelación', () => {
    expect(ratingToSkillScore(PLACEMENT_INITIAL_RATING)).toBe(0);
  });

  it('muestra la categoría declarada mientras es provisional', () => {
    expect(
      resolveVisibleLevelCategory({
        rating: PLACEMENT_INITIAL_RATING,
        categoryStatus: 'provisional',
        declaredCategory: '5ta',
      }),
    ).toBe('5ta');
  });

  it('confirma la categoría desde el rating al salir de nivelación', () => {
    expect(
      resolveVisibleLevelCategory({
        rating: 1300,
        categoryStatus: 'confirmed',
        declaredCategory: '5ta',
      }),
    ).toBe('4ta');
  });

  it('completa la nivelación tras 5 partidos', () => {
    expect(isPlacementComplete(4)).toBe(false);
    expect(isPlacementComplete(PLACEMENT_MATCHES_REQUIRED)).toBe(true);
    expect(normalizeCategoryStatus('provisional')).toBe('provisional');
    expect(normalizeCategoryStatus('confirmed')).toBe('confirmed');
  });
});
