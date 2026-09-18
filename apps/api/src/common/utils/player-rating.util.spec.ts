import {
  DEFAULT_PLAYER_RATING,
  getInitialRatingForCategory,
  resolvePlayerRating,
  ratingToSkillScore,
} from './player-rating.util';

describe('player-rating.util', () => {
  it('usa rating cuando está presente', () => {
    expect(resolvePlayerRating({ rating: 1117 })).toBe(1117);
  });

  it('usa rating por defecto si no hay rating', () => {
    expect(resolvePlayerRating({})).toBe(DEFAULT_PLAYER_RATING);
    expect(resolvePlayerRating({ rating: null })).toBe(DEFAULT_PLAYER_RATING);
  });

  it('mapea categoría a rating inicial', () => {
    expect(getInitialRatingForCategory('5ta')).toBe(1000);
    expect(getInitialRatingForCategory('8va')).toBe(500);
  });

  it('convierte rating a skill score', () => {
    expect(ratingToSkillScore(1000)).toBe(400);
  });
});
