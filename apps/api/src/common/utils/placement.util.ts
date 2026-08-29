import { getLevelCategory } from './level-category.util';
import {
  PLACEMENT_MATCHES_REQUIRED,
  type CategoryStatus,
} from './player-rating.util';

export function normalizeCategoryStatus(
  value: string | null | undefined,
): CategoryStatus {
  return value === 'confirmed' ? 'confirmed' : 'provisional';
}

/**
 * Durante nivelación se muestra la categoría declarada (aspiracional).
 * Al confirmar, la categoría viene del rating Elo.
 */
export function resolveVisibleLevelCategory(input: {
  rating: number;
  categoryStatus?: string | null;
  declaredCategory?: string | null;
}): string {
  const status = normalizeCategoryStatus(input.categoryStatus);
  if (status === 'provisional' && input.declaredCategory) {
    return input.declaredCategory;
  }
  return getLevelCategory(input.rating);
}

export function isPlacementComplete(matchesPlayed: number): boolean {
  return matchesPlayed >= PLACEMENT_MATCHES_REQUIRED;
}
