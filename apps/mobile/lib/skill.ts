export const PLAYER_CATEGORY_OPTIONS = ['8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'] as const;

export type PlayerCategory = (typeof PLAYER_CATEGORY_OPTIONS)[number];

export const MAX_SKILL_SCORE = 1000;

export function clampSkillScore(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(MAX_SKILL_SCORE, Math.round(numeric)));
}

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

export function ratingToSkillScore(rating: number | null | undefined): number {
  const numeric = Number(rating);
  if (Number.isNaN(numeric)) return 0;
  if (numeric <= RATING_SKILL_ANCHORS[0].rating) return 0;

  for (let i = 1; i < RATING_SKILL_ANCHORS.length; i += 1) {
    const previous = RATING_SKILL_ANCHORS[i - 1];
    const current = RATING_SKILL_ANCHORS[i];
    if (numeric <= current.rating) {
      const ratio = (numeric - previous.rating) / (current.rating - previous.rating);
      return clampSkillScore(previous.skill + ratio * (current.skill - previous.skill));
    }
  }

  return MAX_SKILL_SCORE;
}

export function resolveSkillScore(
  skillScore: number | null | undefined,
  legacyRating?: number | null,
): number | undefined {
  if (skillScore != null && !Number.isNaN(Number(skillScore))) {
    const numeric = Number(skillScore);
    if (numeric > MAX_SKILL_SCORE) return ratingToSkillScore(numeric);
    if (numeric <= 100) return clampSkillScore(numeric * 10);
    return clampSkillScore(numeric);
  }
  if (legacyRating == null || Number.isNaN(Number(legacyRating))) return undefined;
  const legacy = Number(legacyRating);
  if (legacy > MAX_SKILL_SCORE) return ratingToSkillScore(legacy);
  if (legacy <= 100) return clampSkillScore(legacy * 10);
  return clampSkillScore(legacy);
}

export function normalizeMatchLevelValue(value: number | null | undefined): number | undefined {
  if (value == null || Number.isNaN(Number(value))) return undefined;
  const numeric = Number(value);
  if (numeric <= 7) {
    return clampSkillScore(((numeric - 1) / 6) * MAX_SKILL_SCORE);
  }
  if (numeric <= 100) {
    return clampSkillScore(numeric * 10);
  }
  return clampSkillScore(numeric);
}

export function formatSkillScore(value: number | null | undefined): string {
  return `${clampSkillScore(value)}/${MAX_SKILL_SCORE}`;
}

export function categoryFromSkillScore(score: number | null | undefined): PlayerCategory {
  const normalized = clampSkillScore(score);
  const categories = [...PLAYER_CATEGORY_OPTIONS].reverse();
  for (const category of categories) {
    const range = getCategoryLevelRange(category);
    if (normalized >= range.min && normalized <= range.max) return category;
  }
  return '5ta';
}

export function formatMatchCategoryRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const normalizedMin = normalizeMatchLevelValue(min);
  const normalizedMax = normalizeMatchLevelValue(max);
  if (normalizedMin == null && normalizedMax == null) return null;
  const catMin = categoryFromSkillScore(normalizedMin ?? 0);
  const catMax = categoryFromSkillScore(normalizedMax ?? MAX_SKILL_SCORE);
  if (catMin === catMax) return `Cat. ${catMin}`;
  return `Cat. ${catMin}–${catMax}`;
}

export function formatSkillRange(min: number | null | undefined, max: number | null | undefined): string {
  const normalizedMin = normalizeMatchLevelValue(min);
  const normalizedMax = normalizeMatchLevelValue(max);
  if (normalizedMin == null && normalizedMax == null) return 'Nivel abierto';
  if (normalizedMin != null && normalizedMax != null) {
    return `Nivel ${normalizedMin}-${normalizedMax}/${MAX_SKILL_SCORE}`;
  }
  if (normalizedMin != null) return `Nivel desde ${normalizedMin}/${MAX_SKILL_SCORE}`;
  return `Nivel hasta ${normalizedMax}/${MAX_SKILL_SCORE}`;
}

export function skillProgressPercent(value: number | null | undefined): number {
  return Math.round((clampSkillScore(value) / MAX_SKILL_SCORE) * 100);
}

/** Progress 0–100 within the player's category band (starts at 0 at category floor). */
export function skillProgressInCategory(
  value: number | null | undefined,
  category?: string | null,
): number {
  if (!category) return skillProgressPercent(value);
  const range = getCategoryLevelRange(category);
  const score = clampSkillScore(value);
  const span = Math.max(1, range.max - range.min);
  return Math.round(Math.max(0, Math.min(100, ((score - range.min) / span) * 100)));
}

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
      return { min: 0, max: MAX_SKILL_SCORE };
  }
}

export function matchOverlapsCategory(
  levelMin: number | null | undefined,
  levelMax: number | null | undefined,
  category: string,
): boolean {
  const range = getCategoryLevelRange(category);
  const matchMin = levelMin ?? 0;
  const matchMax = levelMax ?? MAX_SKILL_SCORE;
  return matchMin <= range.max && matchMax >= range.min;
}

export function playerSkillFitsMatchRange(
  skillScore: number | null | undefined,
  levelMin?: number | null,
  levelMax?: number | null,
): boolean {
  if (skillScore == null) return true;
  const score = clampSkillScore(skillScore);
  const min = levelMin ?? 0;
  const max = levelMax ?? MAX_SKILL_SCORE;
  return score >= min && score <= max;
}
