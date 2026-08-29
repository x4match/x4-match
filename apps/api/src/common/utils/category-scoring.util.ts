import { normalizeSkillScore } from './player-rating.util';

/** Puntos base al ganar o perder contra rivales de nivel parecido. */
export const COMPETITIVE_BASE_POINTS = 200;

/**
 * Ajuste por cada punto de diferencia de nivel (0–1000).
 * Positivo si los rivales son más fuertes → más puntos al ganar, menos al perder.
 */
export const COMPETITIVE_SKILL_FACTOR = 0.2;

/** Mínimo que podés sumar en una victoria. */
export const COMPETITIVE_MIN_WIN_POINTS = 50;

/** Mínimo que perdés en una derrota (magnitud; el valor es negativo). */
export const COMPETITIVE_MIN_LOSS_POINTS = 50;

/** Tope de puntos que podés perder en un partido. */
export const COMPETITIVE_MAX_LOSS_POINTS = 350;

export type CompetitiveMatchOutcome = 'win' | 'loss' | 'draw';

function averageSkill(skills: number[]): number | null {
  if (skills.length === 0) return null;
  return skills.reduce((sum, skill) => sum + skill, 0) / skills.length;
}

/**
 * Puntos por partido competitivo según resultado y nivel de los rivales (0–1000).
 *
 * Victoria:
 * - Rivales de nivel similar → +X
 * - Rivales mucho más débiles → menos que X
 * - Rivales más fuertes → más que X
 *
 * Derrota:
 * - Rivales de nivel similar → −X
 * - Rivales mucho más débiles → perdés más que X
 * - Rivales más fuertes → perdés menos que X
 */
export function computeCompetitiveMatchPoints(
  mySkill: number,
  opponentSkills: number[],
  outcome: CompetitiveMatchOutcome,
): number {
  if (outcome === 'draw') return 0;

  const myLevel = normalizeSkillScore(mySkill);
  const avgOpponent = averageSkill(opponentSkills.map((skill) => normalizeSkillScore(skill)));
  const skillDelta = avgOpponent == null ? 0 : avgOpponent - myLevel;
  const adjustment = Math.round(skillDelta * COMPETITIVE_SKILL_FACTOR);

  if (outcome === 'win') {
    const raw = COMPETITIVE_BASE_POINTS + adjustment;
    return Math.max(COMPETITIVE_MIN_WIN_POINTS, raw);
  }

  const raw = -(COMPETITIVE_BASE_POINTS - adjustment);
  return Math.max(-COMPETITIVE_MAX_LOSS_POINTS, Math.min(-COMPETITIVE_MIN_LOSS_POINTS, raw));
}
