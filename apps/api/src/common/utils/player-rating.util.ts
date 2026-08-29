export const DEFAULT_PLAYER_RATING = 1000;
export const ELO_K_FACTOR = 24;
export const DEFAULT_SKILL_SCORE = 400;
export const MIN_VISIBLE_SKILL_SCORE = 0;
export const MAX_VISIBLE_SKILL_SCORE = 1000;

/** Rating inicial al registrarse sin categoría (skill visible = 0). */
export const PLACEMENT_INITIAL_RATING = 500;
/** Partidos competitivos confirmados para salir de nivelación. */
export const PLACEMENT_MATCHES_REQUIRED = 5;
/** K más alto durante nivelación para calibrar más rápido. */
export const PLACEMENT_ELO_K_FACTOR = 40;

export type CategoryStatus = 'provisional' | 'confirmed';

export const PLAYER_CATEGORIES = ['8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'] as const;
export type PlayerCategory = (typeof PLAYER_CATEGORIES)[number];

/**
 * Rating inicial = piso de la categoría (0% de progreso dentro de la banda).
 * Coincide con getCategoryRatingRange(min), salvo 8va que usa 500 → skill 0.
 */
const CATEGORY_TO_INITIAL_RATING: Record<PlayerCategory, number> = {
  '8va': 500,
  '7ma': 600,
  '6ta': 800,
  '5ta': 1000,
  '4ta': 1200,
  '3ra': 1400,
  '2da': 1700,
  '1ra': 2000,
};

const RATING_SKILL_ANCHORS = [
  { rating: 500, skill: 0 },
  { rating: 600, skill: 160 },
  { rating: 800, skill: 280 },
  { rating: 1000, skill: 400 },
  { rating: 1200, skill: 520 },
  { rating: 1400, skill: 640 },
  { rating: 1700, skill: 760 },
  { rating: 2000, skill: 880 },
  { rating: 2200, skill: 1000 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolate(value: number, start: number, end: number, startOut: number, endOut: number) {
  if (end === start) return startOut;
  return startOut + ((value - start) / (end - start)) * (endOut - startOut);
}

export function normalizeSkillScore(value: number | null | undefined): number {
  const numeric = Number(value ?? DEFAULT_SKILL_SCORE);
  if (Number.isNaN(numeric)) return DEFAULT_SKILL_SCORE;
  return Math.round(clamp(numeric, MIN_VISIBLE_SKILL_SCORE, MAX_VISIBLE_SKILL_SCORE));
}

/** Convierte nivel de pádel (1–7) a rating numérico para categorías. */
export function levelToRating(level: number | null | undefined): number {
  const l = level != null ? Number(level) : 2.5;
  return Math.round(DEFAULT_PLAYER_RATING + (l - 2.5) * 80);
}

export function getInitialRatingForCategory(category: PlayerCategory | null | undefined): number {
  if (!category) return DEFAULT_PLAYER_RATING;
  return CATEGORY_TO_INITIAL_RATING[category] ?? DEFAULT_PLAYER_RATING;
}

export function ratingToSkillScore(rating: number | null | undefined): number {
  const normalizedRating = Number(rating ?? DEFAULT_PLAYER_RATING);
  if (Number.isNaN(normalizedRating)) return DEFAULT_SKILL_SCORE;

  if (normalizedRating <= RATING_SKILL_ANCHORS[0].rating) {
    return RATING_SKILL_ANCHORS[0].skill;
  }

  for (let i = 1; i < RATING_SKILL_ANCHORS.length; i += 1) {
    const previous = RATING_SKILL_ANCHORS[i - 1];
    const current = RATING_SKILL_ANCHORS[i];
    if (normalizedRating <= current.rating) {
      return normalizeSkillScore(
        interpolate(
          normalizedRating,
          previous.rating,
          current.rating,
          previous.skill,
          current.skill,
        ),
      );
    }
  }

  return MAX_VISIBLE_SKILL_SCORE;
}

export function resolvePlayerRating(input: {
  rating?: number | string | null;
  level?: number | string | null;
}): number {
  if (input.rating != null && input.rating !== '') {
    return Math.round(Number(input.rating));
  }
  return levelToRating(input.level != null ? Number(input.level) : null);
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function computeEloDelta(
  rating: number,
  opponentRating: number,
  actualScore: number,
  kFactor = ELO_K_FACTOR,
): number {
  return Math.round(kFactor * (actualScore - expectedScore(rating, opponentRating)));
}
