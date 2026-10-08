import {
  LiveScoreConfig,
  LiveScoreState,
  LiveTeam,
  applyLivePoint,
  createInitialLiveState,
  describeLivePoints,
  liveSetsForResult,
  pressurePoints,
} from './live-score.util';
import { parseBestOfThreeSets } from './match-result.util';

const ADV: LiveScoreConfig = { deuceMode: 'advantage', superTiebreak: false };
const GOLDEN: LiveScoreConfig = { deuceMode: 'golden', superTiebreak: false };
const SUPER: LiveScoreConfig = { deuceMode: 'advantage', superTiebreak: true };

function play(state: LiveScoreState, config: LiveScoreConfig, seq: string): LiveScoreState {
  return seq
    .split('')
    .reduce((s, t) => applyLivePoint(s, config, t as LiveTeam), state);
}

function games(state: LiveScoreState, config: LiveScoreConfig, team: LiveTeam, n: number) {
  return play(state, config, team.repeat(4 * n));
}

describe('live-score.util', () => {
  it('cuenta 15-30-40 y gana el juego', () => {
    let s = play(createInitialLiveState(), ADV, 'AAB');
    expect(describeLivePoints(s, ADV)).toEqual({ teamA: '30', teamB: '15', label: null });
    s = play(s, ADV, 'AA');
    expect(s.games).toEqual({ teamA: 1, teamB: 0 });
    expect(s.points).toEqual({ teamA: 0, teamB: 0 });
  });

  it('con ventaja necesita dos puntos de diferencia', () => {
    let s = play(createInitialLiveState(), ADV, 'AAABBB');
    expect(describeLivePoints(s, ADV).label).toBe('Iguales');
    s = play(s, ADV, 'A');
    expect(describeLivePoints(s, ADV)).toEqual({ teamA: 'AD', teamB: '40', label: 'Ventaja A' });
    s = play(s, ADV, 'B');
    expect(describeLivePoints(s, ADV).label).toBe('Iguales');
    s = play(s, ADV, 'BB');
    expect(s.games).toEqual({ teamA: 0, teamB: 1 });
  });

  it('con punto de oro el 40-40 se define en un punto', () => {
    let s = play(createInitialLiveState(), GOLDEN, 'AAABBB');
    expect(describeLivePoints(s, GOLDEN).label).toBe('Punto de oro');
    s = play(s, GOLDEN, 'B');
    expect(s.games).toEqual({ teamA: 0, teamB: 1 });
  });

  it('cierra el set 6-4 y juega tie-break en 6-6', () => {
    let s = games(createInitialLiveState(), ADV, 'A', 5);
    s = games(s, ADV, 'B', 4);
    s = games(s, ADV, 'A', 1);
    expect(s.sets).toEqual([{ teamA: 6, teamB: 4 }]);

    s = games(s, ADV, 'A', 5);
    s = games(s, ADV, 'B', 6);
    s = games(s, ADV, 'A', 1);
    expect(s.phase).toBe('tiebreak');
    s = play(s, ADV, 'AAAAAABBBBBB');
    expect(s.sets.length).toBe(1);
    s = play(s, ADV, 'BB');
    expect(s.sets[1]).toEqual({ teamA: 6, teamB: 7, tiebreak: { teamA: 6, teamB: 8 } });
    expect(s.phase).toBe('game');
  });

  it('termina el partido con 2 sets y el resultado es válido', () => {
    let s = games(createInitialLiveState(), ADV, 'A', 6);
    s = games(s, ADV, 'A', 5);
    expect(pressurePoints(play(s, ADV, 'AAA'), ADV).matchPointFor).toBe('A');
    s = games(s, ADV, 'A', 1);
    expect(s.winner).toBe('A');
    expect(() => applyLivePoint(s, ADV, 'B')).toThrow();
    expect(parseBestOfThreeSets(liveSetsForResult(s)).winnerTeam).toBe('A');
  });

  it('juega super tie-break a 10 en el tercer set', () => {
    let s = games(createInitialLiveState(), SUPER, 'A', 6);
    s = games(s, SUPER, 'B', 6);
    expect(s.phase).toBe('super_tiebreak');
    s = play(s, SUPER, 'AAAAAAAAABBBBBBBBB');
    expect(s.winner).toBeNull();
    s = play(s, SUPER, 'BB');
    expect(s.winner).toBe('B');
    expect(s.sets[2]).toMatchObject({ teamA: 9, teamB: 11, superTiebreak: true });
    expect(parseBestOfThreeSets(liveSetsForResult(s)).winnerTeam).toBe('B');
  });

  it('marca punto de set', () => {
    let s = games(createInitialLiveState(), ADV, 'B', 5);
    s = play(s, ADV, 'BBB');
    expect(pressurePoints(s, ADV)).toEqual({ matchPointFor: null, setPointFor: 'B' });
  });
});
