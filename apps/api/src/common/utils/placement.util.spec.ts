import {
  isPlacementComplete,
  normalizeCategoryStatus,
  resolvePlacementCategory,
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

  it('con FEJUBA muestra la categoría oficial aunque el rating arranque en skill 0', () => {
    expect(
      resolveVisibleLevelCategory({
        rating: PLACEMENT_INITIAL_RATING,
        categoryStatus: 'confirmed',
        declaredCategory: '6ta',
        lockDeclaredCategory: true,
      }),
    ).toBe('6ta');
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

  describe('resolvePlacementCategory', () => {
    it('confirma la categoría con 3 o más victorias', () => {
      expect(resolvePlacementCategory({ declaredCategory: '5ta', wins: 3 })).toBe('5ta');
      expect(resolvePlacementCategory({ declaredCategory: '5ta', wins: 5 })).toBe('5ta');
    });

    it('baja una categoría con 3 o 4 derrotas', () => {
      expect(resolvePlacementCategory({ declaredCategory: '5ta', wins: 2 })).toBe('6ta');
      expect(resolvePlacementCategory({ declaredCategory: '5ta', wins: 1 })).toBe('6ta');
    });

    it('baja dos categorías si pierde los 5 partidos', () => {
      expect(resolvePlacementCategory({ declaredCategory: '5ta', wins: 0 })).toBe('7ma');
    });

    it('no baja de 8va', () => {
      expect(resolvePlacementCategory({ declaredCategory: '7ma', wins: 0 })).toBe('8va');
      expect(resolvePlacementCategory({ declaredCategory: '8va', wins: 1 })).toBe('8va');
    });
  });
});
