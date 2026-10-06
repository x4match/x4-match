import {
  applyZoneDraft,
  computeGroupStandings,
  groupQualifierEntrants,
  knockoutRoundLabel,
  placeEntrants,
  planGroups,
  rankTeams,
  roundRobinRounds,
  standardSeedOrder,
  teamEntrants,
  validateSets,
  type BracketTeam,
} from './bracket-engine';

function teams(n: number): BracketTeam[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Pareja ${i + 1}`,
    seedPoints: n - i,
    order: i,
  }));
}

describe('bracket-engine', () => {
  it('siembra clásica: 1 y 2 en mitades opuestas', () => {
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
  });

  it('ordena por puntos y desempata por orden de inscripción', () => {
    const ranked = rankTeams([
      { id: 'a', name: 'A', seedPoints: 0, order: 0 },
      { id: 'b', name: 'B', seedPoints: 5, order: 1 },
      { id: 'c', name: 'C', seedPoints: 0, order: 2 },
    ]);
    expect(ranked.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it.each([3, 5, 6, 7, 8, 11, 13, 21, 30])('zonas de 3/4 cubren a las %i parejas', (n) => {
    const groups = planGroups(teams(n));
    const all = groups.flatMap((g) => g.teams.map((t) => t.id));
    expect(new Set(all).size).toBe(n);
    if (n >= 6) {
      for (const g of groups) expect([3, 4]).toContain(g.teams.length);
      groups.forEach((g, i) => expect(g.teams[0].id).toBe(`t${i + 1}`));
    }
  });

  it('todos contra todos en zona: cada cruce una sola vez', () => {
    for (const size of [3, 4, 5]) {
      const rounds = roundRobinRounds(teams(size));
      const keys = rounds.flat().map(([a, b]) => [a.id, b.id].sort().join('-'));
      expect(keys.length).toBe((size * (size - 1)) / 2);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it.each([2, 3, 5, 6, 7, 9, 12, 17, 31])('eliminación con %i parejas: nunca BYE vs BYE', (n) => {
    const slots = placeEntrants(teamEntrants(rankTeams(teams(n))));
    for (let i = 0; i < slots.length; i += 2) {
      expect(slots[i] || slots[i + 1]).toBeTruthy();
    }
    const byes = slots.filter((s) => !s).length;
    expect(byes).toBe(slots.length - n);
    const withBye = new Set<string>();
    for (let i = 0; i < slots.length; i += 2) {
      if (!slots[i] || !slots[i + 1]) withBye.add((slots[i] || slots[i + 1])!.team!.id);
    }
    expect([...withBye].sort()).toEqual(
      Array.from({ length: byes }, (_, i) => `t${i + 1}`).sort(),
    );
  });

  it.each([6, 9, 12, 13, 15, 24])(
    'cuadro desde zonas (%i parejas): 1° y 2° de una zona en mitades opuestas',
    (n) => {
      const groups = planGroups(teams(n));
      const slots = placeEntrants(groupQualifierEntrants(groups));
      const half = slots.length / 2;
      for (const g of groups) {
        const first = slots.findIndex((s) => s?.group === g.code && s.rank === 1);
        const second = slots.findIndex((s) => s?.group === g.code && s.rank === 2);
        expect(first < half).not.toBe(second < half);
      }
      const byes = slots.filter((s) => !s).length;
      if (byes <= groups.length) {
        for (let i = 0; i < slots.length; i += 2) {
          if (!slots[i] || !slots[i + 1]) expect((slots[i] || slots[i + 1])!.rank).toBe(1);
        }
      }
    },
  );

  it('nombres de ronda', () => {
    expect(knockoutRoundLabel(4, 4)).toBe('Final');
    expect(knockoutRoundLabel(1, 4)).toBe('Octavos');
    expect(knockoutRoundLabel(1, 5)).toBe('16avos');
  });

  it('valida sets: sin empates ni partidos sin ganador', () => {
    expect(validateSets([{ teamA: 6, teamB: 3 }, { teamA: 7, teamB: 6 }])).toEqual({
      setsA: 2,
      setsB: 0,
    });
    expect(() => validateSets([{ teamA: 6, teamB: 6 }])).toThrow();
    expect(() => validateSets([{ teamA: 6, teamB: 3 }, { teamA: 3, teamB: 6 }])).toThrow();
    expect(() => validateSets([])).toThrow();
  });

  it('desempate entre dos: manda el partido entre ellos', () => {
    const rows = computeGroupStandings(
      ['a', 'b', 'c'],
      [
        { teamA: 'a', teamB: 'b', winner: 'b', sets: [{ teamA: 6, teamB: 7 }, { teamA: 6, teamB: 7 }] },
        { teamA: 'a', teamB: 'c', winner: 'a', sets: [{ teamA: 6, teamB: 0 }, { teamA: 6, teamB: 0 }] },
        { teamA: 'b', teamB: 'c', winner: 'b', sets: [{ teamA: 6, teamB: 4 }, { teamA: 6, teamB: 4 }] },
      ],
    );
    expect(rows.map((r) => r.registrationId)).toEqual(['b', 'a', 'c']);
  });

  it('triple empate: diferencia de sets y después de games', () => {
    const rows = computeGroupStandings(
      ['a', 'b', 'c'],
      [
        { teamA: 'a', teamB: 'b', winner: 'a', sets: [{ teamA: 6, teamB: 0 }, { teamA: 6, teamB: 0 }] },
        { teamA: 'b', teamB: 'c', winner: 'b', sets: [{ teamA: 6, teamB: 4 }, { teamA: 6, teamB: 4 }] },
        { teamA: 'c', teamB: 'a', winner: 'c', sets: [{ teamA: 6, teamB: 4 }, { teamA: 6, teamB: 4 }] },
      ],
    );
    expect(rows.map((r) => r.registrationId)).toEqual(['a', 'c', 'b']);
  });

  it('el W.O. no suma el punto del perdedor', () => {
    const rows = computeGroupStandings(
      ['a', 'b'],
      [{ teamA: 'a', teamB: 'b', winner: 'a', sets: [], walkover: true }],
    );
    expect(rows[0]).toMatchObject({ registrationId: 'a', points: 2, gamesWon: 12 });
    expect(rows[1]).toMatchObject({ registrationId: 'b', points: 0, walkoverLosses: 1 });
  });

  describe('applyZoneDraft', () => {
    it('respeta las zonas y el orden armados a mano', () => {
      const groups = applyZoneDraft(teams(6), [
        { teamId: 't1', group: 'B', slot: 1 },
        { teamId: 't6', group: 'B', slot: 0 },
        { teamId: 't2', group: 'A', slot: 0 },
        { teamId: 't3', group: 'A', slot: 1 },
        { teamId: 't4', group: 'A', slot: 2 },
        { teamId: 't5', group: 'B', slot: 2 },
      ]);
      expect(groups.map((g) => [g.code, g.teams.map((t) => t.id)])).toEqual([
        ['A', ['t2', 't3', 't4']],
        ['B', ['t6', 't1', 't5']],
      ]);
    });

    it('suma a la zona más chica las parejas nuevas y descarta las que ya no están', () => {
      const groups = applyZoneDraft(teams(7), [
        { teamId: 't1', group: 'A', slot: 0 },
        { teamId: 't2', group: 'A', slot: 1 },
        { teamId: 't3', group: 'A', slot: 2 },
        { teamId: 't4', group: 'B', slot: 0 },
        { teamId: 't5', group: 'B', slot: 1 },
        { teamId: 'gone', group: 'B', slot: 2 },
      ]);
      expect(groups[1].teams.map((t) => t.id)).toEqual(['t4', 't5', 't6']);
      expect(groups[0].teams.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't7']);
    });

    it('renombra zonas vacías y rechaza zonas de una pareja', () => {
      const renamed = applyZoneDraft(teams(4), [
        { teamId: 't1', group: 'C', slot: 0 },
        { teamId: 't2', group: 'C', slot: 1 },
        { teamId: 't3', group: 'D', slot: 0 },
        { teamId: 't4', group: 'D', slot: 1 },
      ]);
      expect(renamed.map((g) => g.code)).toEqual(['A', 'B']);
      expect(() =>
        applyZoneDraft(teams(3), [
          { teamId: 't1', group: 'A', slot: 0 },
          { teamId: 't2', group: 'A', slot: 1 },
          { teamId: 't3', group: 'B', slot: 0 },
        ]),
      ).toThrow(/una sola pareja/);
    });
  });
});
