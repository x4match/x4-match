import { getLevelCategory } from './level-category.util';
import {
  PLACEMENT_MATCHES_REQUIRED,
  PLAYER_CATEGORIES,
  type CategoryStatus,
  type PlayerCategory,
} from './player-rating.util';

/** Victorias mínimas en nivelación para confirmar la categoría declarada. */
export const PLACEMENT_WINS_TO_CONFIRM = 3;

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

/**
 * Categoría final al terminar la nivelación:
 * - 3+ victorias: confirma la declarada.
 * - Pierde todos: baja dos categorías.
 * - 3+ derrotas: baja una categoría.
 * Nunca baja de 8va.
 */
export function resolvePlacementCategory(input: {
  declaredCategory: PlayerCategory;
  wins: number;
  matchesPlayed?: number;
}): PlayerCategory {
  const matchesPlayed = input.matchesPlayed ?? PLACEMENT_MATCHES_REQUIRED;
  const wins = Math.max(0, Math.min(input.wins, matchesPlayed));
  const losses = matchesPlayed - wins;

  let drop = 0;
  if (wins < PLACEMENT_WINS_TO_CONFIRM) {
    drop = losses >= matchesPlayed ? 2 : 1;
  }

  const index = PLAYER_CATEGORIES.indexOf(input.declaredCategory);
  if (index < 0) return input.declaredCategory;
  return PLAYER_CATEGORIES[Math.max(0, index - drop)];
}
