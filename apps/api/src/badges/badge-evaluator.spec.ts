import {
  computeWinStreak,
  evaluateBadge,
  evaluateEligibleBadges,
  isCleanSweepWin,
  isComebackWin,
  type PlayerBadgeContext,
} from './badge-definitions';

function justFinished(
  overrides: Partial<PlayerBadgeContext['justFinished']> = {},
): PlayerBadgeContext['justFinished'] {
  return {
    matchId: 'm1',
    outcome: 'loss',
    mode: 'friendly',
    clubId: null,
    matchHour: 14,
    matchDow: 3,
    isComebackWin: false,
    isCleanSweep: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<PlayerBadgeContext> = {}): PlayerBadgeContext {
  return {
    userId: 'u1',
    completedMatches: 0,
    wins: 0,
    currentWinStreak: 0,
    competitiveMatches: 0,
    maxMatchesAtSingleClub: 0,
    uniqueOpponents: 0,
    justFinished: justFinished(),
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
    expect(
      isComebackWin('A', 'A', [
        { teamA: 3, teamB: 6 },
        { teamA: 6, teamB: 4 },
        { teamA: 6, teamB: 2 },
      ]),
    ).toBe(true);
    expect(isComebackWin('A', 'A', [{ teamA: 6, teamB: 3 }, { teamA: 6, teamB: 4 }])).toBe(false);
  });
});

describe('isCleanSweepWin', () => {
  it('detecta barrida 2-0', () => {
    expect(isCleanSweepWin('A', 'A', [{ teamA: 6, teamB: 3 }, { teamA: 6, teamB: 4 }])).toBe(true);
    expect(
      isCleanSweepWin('A', 'A', [
        { teamA: 6, teamB: 3 },
        { teamA: 4, teamB: 6 },
        { teamA: 6, teamB: 2 },
      ]),
    ).toBe(false);
  });
});

describe('evaluateBadge — nuevas', () => {
  it('ironman_50 / wins / competitive / club loyal', () => {
    expect(evaluateBadge('ironman_50', ctx({ completedMatches: 50 }))).toBe(true);
    expect(evaluateBadge('wins_10', ctx({ wins: 10 }))).toBe(true);
    expect(evaluateBadge('wins_25', ctx({ wins: 24 }))).toBe(false);
    expect(evaluateBadge('competitive_25', ctx({ competitiveMatches: 25 }))).toBe(true);
    expect(evaluateBadge('club_loyal_25', ctx({ maxMatchesAtSingleClub: 25 }))).toBe(true);
  });

  it('early_bird solo con victoria antes de las 10', () => {
    expect(
      evaluateBadge('early_bird', ctx({ justFinished: justFinished({ outcome: 'win', matchHour: 9 }) })),
    ).toBe(true);
    expect(
      evaluateBadge('early_bird', ctx({ justFinished: justFinished({ outcome: 'win', matchHour: 10 }) })),
    ).toBe(false);
  });

  it('weekend_warrior solo sáb/dom con victoria', () => {
    expect(
      evaluateBadge(
        'weekend_warrior',
        ctx({ justFinished: justFinished({ outcome: 'win', matchDow: 6 }) }),
      ),
    ).toBe(true);
    expect(
      evaluateBadge(
        'weekend_warrior',
        ctx({ justFinished: justFinished({ outcome: 'win', matchDow: 3 }) }),
      ),
    ).toBe(false);
  });

  it('clean_sweep y social_10', () => {
    expect(
      evaluateBadge('clean_sweep', ctx({ justFinished: justFinished({ isCleanSweep: true }) })),
    ).toBe(true);
    expect(evaluateBadge('social_10', ctx({ uniqueOpponents: 10 }))).toBe(true);
    expect(evaluateBadge('social_10', ctx({ uniqueOpponents: 9 }))).toBe(false);
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
        ctx({ justFinished: justFinished({ outcome: 'win', matchHour: 21 }) }),
      ),
    ).toBe(true);
    expect(
      evaluateBadge(
        'night_owl',
        ctx({ justFinished: justFinished({ outcome: 'win', matchHour: 19 }) }),
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
        justFinished: justFinished({
          outcome: 'win',
          mode: 'competitive',
          clubId: 'c1',
          matchHour: 10,
        }),
      }),
    );
    expect(eligible).toContain('debut');
    expect(eligible).toContain('first_win');
    expect(eligible).not.toContain('hot_streak_3');
  });
});
