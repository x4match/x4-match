import {
  applyNoveltyToCompetitivePoints,
  applyPointsMultiplier,
  buildTeamMatchupKey,
  computeMatchRatingChanges,
  marginFactor,
  noveltyFactor,
} from './engine';

describe('noveltyFactor', () => {
  it('otorga puntos completos en los primeros encuentros', () => {
    expect(noveltyFactor(0)).toBe(1);
    expect(noveltyFactor(2)).toBe(1);
  });

  it('reduce puntos cuando se repite el mismo cruce', () => {
    expect(noveltyFactor(3)).toBe(0.5);
    expect(noveltyFactor(5)).toBe(0.2);
    expect(noveltyFactor(7)).toBe(0.05);
  });
});

describe('buildTeamMatchupKey', () => {
  it('es simétrico sin importar el orden de equipos', () => {
    const keyA = buildTeamMatchupKey(['u1', 'u2'], ['u3', 'u4']);
    const keyB = buildTeamMatchupKey(['u4', 'u3'], ['u2', 'u1']);
    expect(keyA).toBe(keyB);
  });
});

describe('marginFactor', () => {
  it('no altera partidos muy parejos', () => {
    expect(marginFactor([{ teamA: 7, teamB: 6 }, { teamA: 6, teamB: 7 }])).toBe(1);
  });

  it('premia levemente victorias contundentes', () => {
    expect(marginFactor([{ teamA: 6, teamB: 0 }, { teamA: 6, teamB: 1 }])).toBeGreaterThan(1);
  });
});

describe('computeMatchRatingChanges', () => {
  const participants = [
    { userId: 'a1', rating: 1000, rank: 1 },
    { userId: 'a2', rating: 1000, rank: 2 },
    { userId: 'b1', rating: 1000, rank: 3 },
    { userId: 'b2', rating: 1000, rank: 4 },
  ];

  it('aplica decaimiento cuando ya hubo muchos cruces previos', () => {
    const first = computeMatchRatingChanges({
      participants,
      neededPlayers: 4,
      winnerTeam: 'A',
      priorEncounters: 0,
      sets: [{ teamA: 6, teamB: 4 }, { teamA: 6, teamB: 3 }],
    });
    const repeated = computeMatchRatingChanges({
      participants,
      neededPlayers: 4,
      winnerTeam: 'A',
      priorEncounters: 7,
      sets: [{ teamA: 6, teamB: 4 }, { teamA: 6, teamB: 3 }],
    });

    const winnerFirst = first.find((change) => change.userId === 'a1');
    const winnerRepeated = repeated.find((change) => change.userId === 'a1');
    expect(winnerRepeated?.delta).toBeLessThan(winnerFirst?.delta ?? 0);
    expect(winnerRepeated?.noveltyFactor).toBe(0.05);
  });

  it('mantiene el delta en cero cuando el resultado es esperado y simétrico', () => {
    const changes = computeMatchRatingChanges({
      participants,
      neededPlayers: 4,
      winnerTeam: null,
      priorEncounters: 0,
    });
    for (const change of changes) {
      expect(change.delta).toBeCloseTo(0, 5);
    }
  });

  it('usa K más alto en nivelación para mover más el rating', () => {
    const normal = computeMatchRatingChanges({
      participants,
      neededPlayers: 4,
      winnerTeam: 'A',
      priorEncounters: 0,
    });
    const placement = computeMatchRatingChanges({
      participants: participants.map((player) => ({ ...player, kFactor: 40 })),
      neededPlayers: 4,
      winnerTeam: 'A',
      priorEncounters: 0,
    });

    const normalWinner = normal.find((change) => change.userId === 'a1');
    const placementWinner = placement.find((change) => change.userId === 'a1');
    expect(Math.abs(placementWinner?.delta ?? 0)).toBeGreaterThan(Math.abs(normalWinner?.delta ?? 0));
  });
});

describe('applyNoveltyToCompetitivePoints', () => {
  it('reduce puntos competitivos repetidos pero no los anula del todo', () => {
    expect(applyNoveltyToCompetitivePoints(20, 0)).toBe(20);
    expect(applyNoveltyToCompetitivePoints(20, 6)).toBe(4);
    expect(applyNoveltyToCompetitivePoints(20, 7)).toBe(1);
    expect(applyNoveltyToCompetitivePoints(-20, 7)).toBe(-1);
  });
});

describe('applyPointsMultiplier', () => {
  it('redondea el delta ajustado', () => {
    expect(applyPointsMultiplier(12, 0.5, 1)).toBe(6);
  });
});
