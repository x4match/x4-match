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
 * Con FEJUBA, la categoría oficial queda fija aunque el rating arranque en skill 0.
 * Al confirmar sin FEJUBA, la categoría viene del rating Elo.
 */
export function resolveVisibleLevelCategory(input: {
  rating: number;
  categoryStatus?: string | null;
  declaredCategory?: string | null;
  lockDeclaredCategory?: boolean;
}): string {
  const status = normalizeCategoryStatus(input.categoryStatus);
  if (
    input.declaredCategory &&
    (status === 'provisional' || input.lockDeclaredCategory === true)
  ) {
    return input.declaredCategory;
  }
  return getLevelCategory(input.rating);
}

export function isPlacementComplete(matchesPlayed: number): boolean {
  return matchesPlayed >= PLACEMENT_MATCHES_REQUIRED;
}
