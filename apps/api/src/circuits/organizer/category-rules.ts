import { ALL_CATEGORIES, getLevelCategory } from '../../common/utils/level-category.util';

export type CircuitCategoryKind = 'FIXED' | 'SUM' | 'OPEN';

export type CategorySpec = {
  kind: CircuitCategoryKind;
  level: number | null;
  sumTotal: number | null;
};

export const MIN_LEVEL = 1;
export const MAX_LEVEL = ALL_CATEGORIES.length;
export const MIN_SUM = MIN_LEVEL * 2;
export const MAX_SUM = MAX_LEVEL * 2;

/** "4ta", "4°", "Suma 07", "Damas Suma 9" … → nivel o suma. Lo demás es categoría libre. */
export function parseCategoryLabel(label: string | null | undefined): CategorySpec {
  const text = String(label ?? '').trim().toLowerCase();
  const sum = /suma\s*0*(\d{1,2})\b/.exec(text);
  if (sum) {
    const total = Number(sum[1]);
    if (total >= MIN_SUM && total <= MAX_SUM) return { kind: 'SUM', level: null, sumTotal: total };
  }
  const fixed = /^(?:(?:caballeros|damas|mixto)\s+)?([1-8])\s*(?:ra|da|ta|ma|va|°|º)(?![a-z])/.exec(text);
  if (fixed) return { kind: 'FIXED', level: Number(fixed[1]), sumTotal: null };
  return { kind: 'OPEN', level: null, sumTotal: null };
}

export function levelLabel(level: number | null | undefined): string | null {
  if (level == null) return null;
  return ALL_CATEGORIES[level - 1] ?? null;
}

export function levelFromLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const index = ALL_CATEGORIES.indexOf(label.trim());
  return index >= 0 ? index + 1 : null;
}

export function levelFromRating(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(Number(rating))) return null;
  return levelFromLabel(getLevelCategory(Number(rating)));
}

export function isValidLevel(level: unknown): level is number {
  return Number.isInteger(level) && (level as number) >= MIN_LEVEL && (level as number) <= MAX_LEVEL;
}

export type EligibilityResult =
  | { status: 'OK' }
  | { status: 'REVIEW'; reason: string }
  | { status: 'BLOCKED'; reason: string };

/**
 * Regla del circuito: nadie juega "para abajo".
 * - Categoría fija N: cada jugador tiene que ser de N o de una categoría más débil (número ≥ N).
 * - Suma N: la suma de las categorías de la pareja tiene que ser ≥ N.
 * Si falta la categoría de algún jugador, la inscripción queda para que el organizador la valide.
 */
export function checkTeamEligibility(
  category: CategorySpec,
  levels: [number | null, number | null],
  names: [string, string] = ['Jugador 1', 'Jugador 2'],
): EligibilityResult {
  if (category.kind === 'OPEN') return { status: 'OK' };

  const missing = names.filter((_, i) => levels[i] == null);
  if (missing.length) {
    return {
      status: 'REVIEW',
      reason: `Sin categoría en el circuito: ${missing.join(' y ')}. El organizador tiene que validarla.`,
    };
  }
  const [a, b] = levels as [number, number];

  if (category.kind === 'FIXED' && category.level != null) {
    const stronger = names.filter((_, i) => (levels[i] as number) < category.level!);
    if (stronger.length) {
      return {
        status: 'BLOCKED',
        reason:
          `${stronger.join(' y ')} ${stronger.length > 1 ? 'son' : 'es'} de una categoría superior a ` +
          `${levelLabel(category.level)}: no se puede jugar para abajo.`,
      };
    }
    return { status: 'OK' };
  }

  if (category.kind === 'SUM' && category.sumTotal != null) {
    if (a + b < category.sumTotal) {
      return {
        status: 'BLOCKED',
        reason:
          `La pareja suma ${a + b} (${levelLabel(a)} + ${levelLabel(b)}) y la categoría pide ` +
          `al menos ${category.sumTotal}.`,
      };
    }
    return { status: 'OK' };
  }

  return { status: 'OK' };
}

export type PromotionSuggestion = {
  direction: 'PROMOTION' | 'RELEGATION';
  toLevel: number;
};

/**
 * Sugerencia de ascenso/descenso al cierre de la temporada según la posición en el ranking
 * de una categoría fija: los primeros `promoteTop` suben, los últimos `relegateBottom` bajan.
 */
export function suggestLevelChange(
  categoryLevel: number,
  position: number,
  totalRanked: number,
  promoteTop: number,
  relegateBottom: number,
): PromotionSuggestion | null {
  if (position <= promoteTop && categoryLevel > MIN_LEVEL) {
    return { direction: 'PROMOTION', toLevel: categoryLevel - 1 };
  }
  if (
    relegateBottom > 0 &&
    totalRanked > promoteTop + relegateBottom &&
    position > totalRanked - relegateBottom &&
    categoryLevel < MAX_LEVEL
  ) {
    return { direction: 'RELEGATION', toLevel: categoryLevel + 1 };
  }
  return null;
}
