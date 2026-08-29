import { computeEloDelta, ELO_K_FACTOR } from '../common/utils/player-rating.util';
import { COMPETITIVE_MIN_WIN_POINTS } from '../common/utils/category-scoring.util';
import { userTeamFromRank } from '../common/utils/match-result.util';

export const RATING_REPEAT_WINDOW_DAYS = 30;
export const MIN_PLAYER_RATING = 100;

/** Encuentros previos en la ventana → factor de puntos (rendimientos decrecientes). */
const NOVELTY_THRESHOLDS: ReadonlyArray<{ upTo: number; factor: number }> = [
  { upTo: 2, factor: 1 },
  { upTo: 4, factor: 0.5 },
  { upTo: 6, factor: 0.2 },
  { upTo: Number.POSITIVE_INFINITY, factor: 0.05 },
];

export type RatingTeam = 'A' | 'B';

export type RatingParticipant = {
  userId: string;
  rating: number;
  rank: number;
  /** K factor propio (p.ej. más alto en nivelación). */
  kFactor?: number;
};

export type SetScore = { teamA: number; teamB: number };

export type MatchRatingChange = {
  userId: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  rawDelta: number;
  noveltyFactor: number;
  marginFactor: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function noveltyFactor(priorEncounters: number): number {
  const count = Math.max(0, Math.floor(priorEncounters));
  for (const threshold of NOVELTY_THRESHOLDS) {
    if (count <= threshold.upTo) return threshold.factor;
  }
  return NOVELTY_THRESHOLDS[NOVELTY_THRESHOLDS.length - 1].factor;
}

export function buildTeamMatchupKey(teamAUserIds: string[], teamBUserIds: string[]): string {
  const normalizeTeam = (userIds: string[]) => [...userIds].sort().join(':');
  const teamA = normalizeTeam(teamAUserIds);
  const teamB = normalizeTeam(teamBUserIds);
  return [teamA, teamB].sort().join('|');
}

export function splitParticipantsByTeam<T extends { userId: string; rank: number }>(
  participants: T[],
  neededPlayers: number,
): { teamA: T[]; teamB: T[] } {
  return {
    teamA: participants.filter((player) => userTeamFromRank(player.rank, neededPlayers) === 'A'),
    teamB: participants.filter((player) => userTeamFromRank(player.rank, neededPlayers) === 'B'),
  };
}

export function buildMatchupKeyFromParticipants(
  participants: Array<{ userId: string; rank: number }>,
  neededPlayers: number,
): string | null {
  const { teamA, teamB } = splitParticipantsByTeam(participants, neededPlayers);
  if (teamA.length === 0 || teamB.length === 0) return null;
  return buildTeamMatchupKey(
    teamA.map((player) => player.userId),
    teamB.map((player) => player.userId),
  );
}

/** Ajuste suave según dominancia del marcador (0.8 – 1.2). */
export function marginFactor(sets: SetScore[]): number {
  if (!sets.length) return 1;

  let gamesA = 0;
  let gamesB = 0;
  for (const set of sets) {
    gamesA += set.teamA;
    gamesB += set.teamB;
  }

  const total = gamesA + gamesB;
  if (total === 0) return 1;

  const winnerShare = Math.max(gamesA, gamesB) / total;
  return clamp(1 + (winnerShare - 0.5) * 0.8, 0.8, 1.2);
}

export function applyPointsMultiplier(baseDelta: number, novelty: number, margin: number): number {
  return Math.round(baseDelta * novelty * margin);
}

export function computeMatchRatingChanges(input: {
  participants: RatingParticipant[];
  neededPlayers: number;
  winnerTeam: RatingTeam | null;
  priorEncounters: number;
  sets?: SetScore[];
}): MatchRatingChange[] {
  const { teamA, teamB } = splitParticipantsByTeam(input.participants, input.neededPlayers);
  if (teamA.length === 0 || teamB.length === 0) return [];

  const averageRating = (team: RatingParticipant[]) =>
    team.reduce((sum, player) => sum + player.rating, 0) / team.length;

  const teamARating = averageRating(teamA);
  const teamBRating = averageRating(teamB);
  const normalizedWinner = String(input.winnerTeam || '')
    .toUpperCase()
    .trim();
  const actualScoreA =
    normalizedWinner === 'A' ? 1 : normalizedWinner === 'B' ? 0 : 0.5;

  const novelty = noveltyFactor(input.priorEncounters);
  const margin = marginFactor(input.sets ?? []);

  return input.participants.map((player) => {
    const team = userTeamFromRank(player.rank, input.neededPlayers);
    const myTeamRating = team === 'A' ? teamARating : teamBRating;
    const oppTeamRating = team === 'A' ? teamBRating : teamARating;
    const actualScore = team === 'A' ? actualScoreA : 1 - actualScoreA;
    const kFactor = player.kFactor ?? ELO_K_FACTOR;
    const rawDelta = computeEloDelta(myTeamRating, oppTeamRating, actualScore, kFactor);
    const delta = applyPointsMultiplier(rawDelta, novelty, margin);
    const ratingBefore = player.rating;
    return {
      userId: player.userId,
      ratingBefore,
      ratingAfter: Math.max(MIN_PLAYER_RATING, ratingBefore + delta),
      delta,
      rawDelta,
      noveltyFactor: novelty,
      marginFactor: margin,
    };
  });
}

export function applyNoveltyToCompetitivePoints(basePoints: number, priorEncounters: number): number {
  if (basePoints === 0) return 0;
  const adjusted = Math.round(basePoints * noveltyFactor(priorEncounters));
  const minMagnitude = Math.max(10, Math.round(COMPETITIVE_MIN_WIN_POINTS / 5));
  if (basePoints > 0) return Math.max(minMagnitude, adjusted);
  return Math.min(-minMagnitude, adjusted);
}
