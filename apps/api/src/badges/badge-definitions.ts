export type BadgeCode =
  | 'debut'
  | 'first_win'
  | 'ironman_10'
  | 'ironman_25'
  | 'hot_streak_3'
  | 'hot_streak_5'
  | 'hot_streak_10'
  | 'comeback'
  | 'competitive_5'
  | 'club_regular'
  | 'night_owl';

export type MatchOutcome = 'win' | 'loss' | 'draw';

export type PlayerBadgeContext = {
  userId: string;
  completedMatches: number;
  wins: number;
  currentWinStreak: number;
  competitiveMatches: number;
  maxMatchesAtSingleClub: number;
  justFinished: {
    matchId: string;
    outcome: MatchOutcome;
    mode: string;
    clubId: string | null;
    matchHour: number;
    isComebackWin: boolean;
  };
};

export const BADGE_CODES: BadgeCode[] = [
  'debut',
  'first_win',
  'ironman_10',
  'ironman_25',
  'hot_streak_3',
  'hot_streak_5',
  'hot_streak_10',
  'comeback',
  'competitive_5',
  'club_regular',
  'night_owl',
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
    case 'club_regular':
      return ctx.maxMatchesAtSingleClub >= 5;
    case 'night_owl':
      return ctx.justFinished.outcome === 'win' && ctx.justFinished.matchHour >= 20;
    default:
      return false;
  }
}

export function evaluateEligibleBadges(ctx: PlayerBadgeContext): BadgeCode[] {
  return BADGE_CODES.filter((code) => evaluateBadge(code, ctx));
}
