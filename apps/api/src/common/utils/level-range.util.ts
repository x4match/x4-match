/** Rango visible de skill (0–1000) por categoría competitiva. */
const CATEGORY_ORDER = ['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va'] as const;

export type PlayerCategoryCode = (typeof CATEGORY_ORDER)[number];

export function getCategoryLevelRange(category: string): { min: number; max: number } {
  switch (category) {
    case '1ra':
      return { min: 880, max: 1000 };
    case '2da':
      return { min: 760, max: 879 };
    case '3ra':
      return { min: 640, max: 759 };
    case '4ta':
      return { min: 520, max: 639 };
    case '5ta':
      return { min: 400, max: 519 };
    case '6ta':
      return { min: 280, max: 399 };
    case '7ma':
      return { min: 160, max: 279 };
    case '8va':
      return { min: 0, max: 159 };
    default:
      return { min: 0, max: 1000 };
  }
}

/**
 * Desplaza una categoría hacia un nivel más bajo (más débil).
 * Útil para equivalencia damas ↔ caballeros en mixtos (típicamente −1/−2).
 */
export function shiftCategoryWeaker(category: string, steps = 1): string {
  const idx = CATEGORY_ORDER.indexOf(category as PlayerCategoryCode);
  if (idx < 0) return category;
  const next = Math.min(CATEGORY_ORDER.length - 1, idx + Math.max(0, steps));
  return CATEGORY_ORDER[next];
}

/**
 * Banda de skill para partidos mixtos cuando la creadora es mujer:
 * usa desde su categoría hasta 2 niveles más bajos (equivalencia caballeros).
 */
export function getFemaleMixedLevelRange(category: string): { min: number; max: number } {
  const own = getCategoryLevelRange(category);
  const weaker = getCategoryLevelRange(shiftCategoryWeaker(category, 2));
  return {
    min: Math.min(own.min, weaker.min),
    max: Math.max(own.max, weaker.max),
  };
}

export function defaultLevelBand(level: number, margin = 100): { min: number; max: number } {
  return {
    min: Math.max(0, Math.round(level - margin)),
    max: Math.min(1000, Math.round(level + margin)),
  };
}
