import {
  computeWinStreak,
  evaluateBadge,
  evaluateEligibleBadges,
  isComebackWin,
  type PlayerBadgeContext,
} from './badge-definitions';

function ctx(overrides: Partial<PlayerBadgeContext> = {}): PlayerBadgeContext {
  return {
    userId: 'u1',
    completedMatches: 0,
    wins: 0,
    currentWinStreak: 0,
    competitiveMatches: 0,
    maxMatchesAtSingleClub: 0,
    justFinished: {
      matchId: 'm1',
      outcome: 'loss',
      mode: 'friendly',
      clubId: null,
      matchHour: 14,
      isComebackWin: false,
    },
    ...overrides,
  };
}

describe('computeWinStreak', () => {
  it('cuenta victorias consecutivas al final', () => {
    expect(computeWinStreak(['loss', 'win', 'win', 'win'])).toBe(3);
    expect(computeWinStreak(['win', 'loss', 'win'])).toBe(1);
    expect(computeWinStreak(['loss', 'draw', 'loss'])).toBe(0);
  });
});

describe('isComebackWin', () => {
  it('detecta remontada tras perder el primer set', () => {
    expect(isComebackWin('A', 'A', [{ teamA: 3, teamB: 6 }, { teamA: 6, teamB: 4 }, { teamA: 6, teamB: 2 }])).toBe(
      true,
    );
    expect(isComebackWin('A', 'A', [{ teamA: 6, teamB: 3 }, { teamA: 6, teamB: 4 }])).toBe(false);
    expect(isComebackWin('A', 'B', [{ teamA: 3, teamB: 6 }, { teamA: 6, teamB: 4 }])).toBe(false);
  });
});

describe('evaluateBadge', () => {
  it('otorga debut con un partido completado', () => {
    expect(evaluateBadge('debut', ctx({ completedMatches: 1 }))).toBe(true);
  });

  it('otorga racha x5 con 5 victorias seguidas', () => {
    expect(evaluateBadge('hot_streak_5', ctx({ currentWinStreak: 5 }))).toBe(true);
    expect(evaluateBadge('hot_streak_5', ctx({ currentWinStreak: 4 }))).toBe(false);
  });

  it('otorga nocturno solo con victoria nocturna', () => {
    expect(
      evaluateBadge(
        'night_owl',
        ctx({
          justFinished: {
            matchId: 'm1',
            outcome: 'win',
            mode: 'friendly',
            clubId: null,
            matchHour: 21,
            isComebackWin: false,
          },
        }),
      ),
    ).toBe(true);
    expect(
      evaluateBadge(
        'night_owl',
        ctx({
          justFinished: {
            matchId: 'm1',
            outcome: 'win',
            mode: 'friendly',
            clubId: null,
            matchHour: 19,
            isComebackWin: false,
          },
        }),
      ),
    ).toBe(false);
  });
});

describe('evaluateEligibleBadges', () => {
  it('devuelve varias insignias en el debut con victoria', () => {
    const eligible = evaluateEligibleBadges(
      ctx({
        completedMatches: 1,
        wins: 1,
        currentWinStreak: 1,
        justFinished: {
          matchId: 'm1',
          outcome: 'win',
          mode: 'competitive',
          clubId: 'c1',
          matchHour: 10,
          isComebackWin: false,
        },
      }),
    );
    expect(eligible).toContain('debut');
    expect(eligible).toContain('first_win');
    expect(eligible).not.toContain('hot_streak_3');
  });
});
