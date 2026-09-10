/**
 * Puntos competitivos mensuales por diferencia de categoría.
 * Aplica solo a partidos futuros; el ledger histórico no se recalcula.
 *
 * Orden (más fuerte = mayor ordinal): 8va < 7ma < … < 1ra
 */

/** Puntos base al ganar o perder contra rivales de la misma categoría. */
export const COMPETITIVE_BASE_POINTS = 100;

/** Magnitud mínima usada por novelty del motor Elo (no es piso de la tabla). */
export const COMPETITIVE_MIN_WIN_POINTS = 30;

export type CompetitiveMatchOutcome = 'win' | 'loss' | 'draw';

/** Más débil → más fuerte. */
const CATEGORY_STRENGTH_ORDER = [
  '8va',
  '7ma',
  '6ta',
  '5ta',
  '4ta',
  '3ra',
  '2da',
  '1ra',
] as const;

type CategoryStrength = (typeof CATEGORY_STRENGTH_ORDER)[number];

/** win / loss por Δ = cat_rivales − mi_cat (clamp a ±2). */
const POINTS_BY_DELTA: Readonly<Record<number, { win: number; loss: number }>> = {
  2: { win: 140, loss: -40 },
  1: { win: 120, loss: -60 },
  0: { win: COMPETITIVE_BASE_POINTS, loss: -COMPETITIVE_BASE_POINTS },
  [-1]: { win: 60, loss: -140 },
  [-2]: { win: 30, loss: -175 },
};

export function categoryStrengthOrdinal(category: string): number | null {
  const idx = CATEGORY_STRENGTH_ORDER.indexOf(category as CategoryStrength);
  return idx >= 0 ? idx : null;
}

function averageOpponentOrdinal(opponentCategories: string[]): number | null {
  const ordinals = opponentCategories
    .map((category) => categoryStrengthOrdinal(category))
    .filter((value): value is number => value != null);
  if (ordinals.length === 0) return null;
  return ordinals.reduce((sum, value) => sum + value, 0) / ordinals.length;
}

/**
 * Δ de categoría: promedio de rivales redondeado − mi categoría.
 * Positivo = rivales más fuertes.
 */
export function computeCategoryDelta(
  myCategory: string,
  opponentCategories: string[],
): number {
  const myOrdinal = categoryStrengthOrdinal(myCategory);
  if (myOrdinal == null) return 0;
  const avgOpponent = averageOpponentOrdinal(opponentCategories);
  if (avgOpponent == null) return 0;
  return Math.round(avgOpponent) - myOrdinal;
}

function clampDelta(delta: number): -2 | -1 | 0 | 1 | 2 {
  if (delta >= 2) return 2;
  if (delta <= -2) return -2;
  if (delta === 1 || delta === -1 || delta === 0) return delta;
  return 0;
}

/** Puntos base (antes de novelty) según fila de la tabla. */
export function getCompetitiveBasePointsForDelta(delta: number): number {
  const row = POINTS_BY_DELTA[clampDelta(delta)];
  return Math.abs(row.win);
}

/**
 * Puntos por partido competitivo según Δ de categoría con los rivales.
 *
 * | Δ | Win | Loss |
 * | +2+ | +140 | −40 |
 * | +1 | +120 | −60 |
 * | 0 | +100 | −100 |
 * | −1 | +60 | −140 |
 * | −2+ | +30 | −175 |
 */
export function computeCompetitiveMatchPoints(
  myCategory: string,
  opponentCategories: string[],
  outcome: CompetitiveMatchOutcome,
): number {
  if (outcome === 'draw') return 0;

  const delta = clampDelta(computeCategoryDelta(myCategory, opponentCategories));
  const row = POINTS_BY_DELTA[delta];
  return outcome === 'win' ? row.win : row.loss;
}
