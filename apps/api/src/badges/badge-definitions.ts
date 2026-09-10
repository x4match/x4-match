export type BadgeCode =
  | 'debut'
  | 'first_win'
  | 'ironman_10'
  | 'ironman_25'
  | 'ironman_50'
  | 'wins_10'
  | 'wins_25'
  | 'hot_streak_3'
  | 'hot_streak_5'
  | 'hot_streak_10'
  | 'comeback'
  | 'competitive_5'
  | 'competitive_25'
  | 'club_regular'
  | 'club_loyal_25'
  | 'night_owl'
  | 'early_bird'
  | 'weekend_warrior'
  | 'clean_sweep'
  | 'social_10'
  | 'interclub_champion'
  | 'interclub_challenger';

export type MatchOutcome = 'win' | 'loss' | 'draw';

export type PlayerBadgeContext = {
  userId: string;
  completedMatches: number;
  wins: number;
  currentWinStreak: number;
  competitiveMatches: number;
  maxMatchesAtSingleClub: number;
  uniqueOpponents: number;
  justFinished: {
    matchId: string;
    outcome: MatchOutcome;
    mode: string;
    clubId: string | null;
    matchHour: number;
    /** Day of week: 0 = Sunday … 6 = Saturday (JS Date#getDay). */
    matchDow: number;
    isComebackWin: boolean;
    isCleanSweep: boolean;
  };
};

export const BADGE_CODES: BadgeCode[] = [
  'debut',
  'first_win',
  'ironman_10',
  'ironman_25',
  'ironman_50',
  'wins_10',
  'wins_25',
  'hot_streak_3',
  'hot_streak_5',
  'hot_streak_10',
  'comeback',
  'competitive_5',
  'competitive_25',
  'club_regular',
  'club_loyal_25',
  'night_owl',
  'early_bird',
  'weekend_warrior',
  'clean_sweep',
  'social_10',
  'interclub_champion',
  'interclub_challenger',
];

export function computeWinStreak(outcomes: MatchOutcome[]): number {
  let streak = 0;
  for (let i = outcomes.length - 1; i >= 0; i -= 1) {
    if (outcomes[i] === 'win') streak += 1;
    else break;
  }
  return streak;
}

export function isComebackWin(
  myTeam: 'A' | 'B',
  winnerTeam: string | null,
  sets: Array<{ teamA: number; teamB: number }>,
): boolean {
  const winner = String(winnerTeam || '')
    .toUpperCase()
    .trim();
  if (winner !== myTeam || sets.length < 2) return false;

  const firstSet = sets[0];
  const firstSetWinner =
    firstSet.teamA === firstSet.teamB ? null : firstSet.teamA > firstSet.teamB ? 'A' : 'B';
  return firstSetWinner != null && firstSetWinner !== myTeam;
}

/** Victoria 2–0 en mejor de 3 (exactamente 2 sets ganados, 0 perdidos). */
export function isCleanSweepWin(
  myTeam: 'A' | 'B',
  winnerTeam: string | null,
  sets: Array<{ teamA: number; teamB: number }>,
): boolean {
  const winner = String(winnerTeam || '')
    .toUpperCase()
    .trim();
  if (winner !== myTeam || sets.length < 2) return false;

  let won = 0;
  let lost = 0;
  for (const set of sets) {
    if (set.teamA === set.teamB) continue;
    const setWinner = set.teamA > set.teamB ? 'A' : 'B';
    if (setWinner === myTeam) won += 1;
    else lost += 1;
  }
  return won === 2 && lost === 0;
}

export function evaluateBadge(code: BadgeCode, ctx: PlayerBadgeContext): boolean {
  switch (code) {
    case 'debut':
      return ctx.completedMatches >= 1;
    case 'first_win':
      return ctx.wins >= 1;
    case 'ironman_10':
      return ctx.completedMatches >= 10;
    case 'ironman_25':
      return ctx.completedMatches >= 25;
    case 'ironman_50':
      return ctx.completedMatches >= 50;
    case 'wins_10':
      return ctx.wins >= 10;
    case 'wins_25':
      return ctx.wins >= 25;
    case 'hot_streak_3':
      return ctx.currentWinStreak >= 3;
    case 'hot_streak_5':
      return ctx.currentWinStreak >= 5;
    case 'hot_streak_10':
      return ctx.currentWinStreak >= 10;
    case 'comeback':
      return ctx.justFinished.isComebackWin;
    case 'competitive_5':
      return ctx.competitiveMatches >= 5;
    case 'competitive_25':
      return ctx.competitiveMatches >= 25;
    case 'club_regular':
      return ctx.maxMatchesAtSingleClub >= 5;
    case 'club_loyal_25':
      return ctx.maxMatchesAtSingleClub >= 25;
    case 'night_owl':
      return ctx.justFinished.outcome === 'win' && ctx.justFinished.matchHour >= 20;
    case 'early_bird':
      return ctx.justFinished.outcome === 'win' && ctx.justFinished.matchHour < 10;
    case 'weekend_warrior':
      return (
        ctx.justFinished.outcome === 'win' &&
        (ctx.justFinished.matchDow === 0 || ctx.justFinished.matchDow === 6)
      );
    case 'clean_sweep':
      return ctx.justFinished.isCleanSweep;
    case 'social_10':
      return ctx.uniqueOpponents >= 10;
    case 'interclub_champion':
    case 'interclub_challenger':
      // Otorgadas por ChallengesService al completar un desafío.
      return false;
    default:
      return false;
  }
}

export function evaluateEligibleBadges(ctx: PlayerBadgeContext): BadgeCode[] {
  return BADGE_CODES.filter((code) => evaluateBadge(code, ctx));
}
