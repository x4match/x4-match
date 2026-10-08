export type LiveTeam = 'A' | 'B';
export type DeuceMode = 'advantage' | 'golden';

export type LiveScoreConfig = {
  deuceMode: DeuceMode;
  /** El tercer set se define con un super tie-break a 10. */
  superTiebreak: boolean;
};

export type TeamPair = { teamA: number; teamB: number };

export type LiveCompletedSet = TeamPair & {
  /** Puntos del tie-break (7-6) o del super tie-break. */
  tiebreak?: TeamPair;
  superTiebreak?: boolean;
};

export type LivePhase = 'game' | 'tiebreak' | 'super_tiebreak';

export type LiveScoreState = {
  sets: LiveCompletedSet[];
  games: TeamPair;
  points: TeamPair;
  phase: LivePhase;
  winner: LiveTeam | null;
  totalPoints: number;
};

const GAMES_PER_SET = 6;
const TIEBREAK_TARGET = 7;
const SUPER_TIEBREAK_TARGET = 10;
const SETS_TO_WIN = 2;

export function createInitialLiveState(): LiveScoreState {
  return {
    sets: [],
    games: { teamA: 0, teamB: 0 },
    points: { teamA: 0, teamB: 0 },
    phase: 'game',
    winner: null,
    totalPoints: 0,
  };
}

function key(team: LiveTeam): keyof TeamPair {
  return team === 'A' ? 'teamA' : 'teamB';
}

function other(team: LiveTeam): LiveTeam {
  return team === 'A' ? 'B' : 'A';
}

function setsWon(sets: LiveCompletedSet[], team: LiveTeam) {
  const k = key(team);
  const o = key(other(team));
  return sets.filter((s) => s[k] > s[o]).length;
}

function wonByTwo(p: number, o: number, target: number) {
  return p >= target && p - o >= 2;
}

function closeSet(state: LiveScoreState, config: LiveScoreConfig, completed: LiveCompletedSet) {
  state.sets.push(completed);
  state.games = { teamA: 0, teamB: 0 };
  state.points = { teamA: 0, teamB: 0 };

  const wonA = setsWon(state.sets, 'A');
  const wonB = setsWon(state.sets, 'B');
  if (wonA >= SETS_TO_WIN || wonB >= SETS_TO_WIN) {
    state.winner = wonA > wonB ? 'A' : 'B';
    state.phase = 'game';
    return;
  }
  state.phase =
    config.superTiebreak && wonA === SETS_TO_WIN - 1 && wonB === SETS_TO_WIN - 1
      ? 'super_tiebreak'
      : 'game';
}

function winGame(state: LiveScoreState, config: LiveScoreConfig, team: LiveTeam) {
  const k = key(team);
  const o = key(other(team));
  state.games[k] += 1;
  state.points = { teamA: 0, teamB: 0 };

  if (wonByTwo(state.games[k], state.games[o], GAMES_PER_SET)) {
    closeSet(state, config, { ...state.games });
    return;
  }
  if (state.games.teamA === GAMES_PER_SET && state.games.teamB === GAMES_PER_SET) {
    state.phase = 'tiebreak';
  }
}

/** Devuelve un estado nuevo con el punto sumado al equipo indicado. */
export function applyLivePoint(
  current: LiveScoreState,
  config: LiveScoreConfig,
  team: LiveTeam,
): LiveScoreState {
  if (current.winner) {
    throw new Error('El partido ya terminó');
  }

  const state: LiveScoreState = JSON.parse(JSON.stringify(current));
  const k = key(team);
  const o = key(other(team));
  state.points[k] += 1;
  state.totalPoints += 1;
  const p = state.points[k];
  const op = state.points[o];

  if (state.phase === 'super_tiebreak') {
    if (wonByTwo(p, op, SUPER_TIEBREAK_TARGET)) {
      closeSet(state, config, {
        teamA: state.points.teamA,
        teamB: state.points.teamB,
        tiebreak: { ...state.points },
        superTiebreak: true,
      });
    }
    return state;
  }

  if (state.phase === 'tiebreak') {
    if (wonByTwo(p, op, TIEBREAK_TARGET)) {
      const tiebreak = { ...state.points };
      state.games[k] += 1;
      state.points = { teamA: 0, teamB: 0 };
      closeSet(state, config, { ...state.games, tiebreak });
    }
    return state;
  }

  const goldenPoint = config.deuceMode === 'golden' && p === 4 && op === 3;
  if (p >= 4 && (p - op >= 2 || goldenPoint)) {
    winGame(state, config, team);
  }
  return state;
}

const POINT_LABELS = ['0', '15', '30', '40'];

export type LiveDisplay = {
  teamA: string;
  teamB: string;
  label: string | null;
};

export function describeLivePoints(state: LiveScoreState, config: LiveScoreConfig): LiveDisplay {
  const { teamA: a, teamB: b } = state.points;
  if (state.winner) {
    return { teamA: '', teamB: '', label: null };
  }
  if (state.phase === 'tiebreak') {
    return { teamA: String(a), teamB: String(b), label: 'Tie-break' };
  }
  if (state.phase === 'super_tiebreak') {
    return { teamA: String(a), teamB: String(b), label: 'Super tie-break' };
  }
  if (a >= 3 && b >= 3) {
    if (a === b) {
      return {
        teamA: '40',
        teamB: '40',
        label: config.deuceMode === 'golden' ? 'Punto de oro' : 'Iguales',
      };
    }
    const leader: LiveTeam = a > b ? 'A' : 'B';
    return {
      teamA: leader === 'A' ? 'AD' : '40',
      teamB: leader === 'B' ? 'AD' : '40',
      label: `Ventaja ${leader}`,
    };
  }
  return { teamA: POINT_LABELS[a] ?? String(a), teamB: POINT_LABELS[b] ?? String(b), label: null };
}

/** Equipo que gana el partido / el set si suma el próximo punto. */
export function pressurePoints(state: LiveScoreState, config: LiveScoreConfig) {
  if (state.winner) return { matchPointFor: null, setPointFor: null };
  let matchPointFor: LiveTeam | null = null;
  let setPointFor: LiveTeam | null = null;
  for (const team of ['A', 'B'] as LiveTeam[]) {
    const next = applyLivePoint(state, config, team);
    if (next.winner === team) matchPointFor = team;
    else if (next.sets.length > state.sets.length) setPointFor = team;
  }
  return { matchPointFor, setPointFor };
}

/** Sets cerrados en el formato que espera `parseBestOfThreeSets`. */
export function liveSetsForResult(state: LiveScoreState): TeamPair[] {
  return state.sets.map((s) => ({ teamA: s.teamA, teamB: s.teamB }));
}
