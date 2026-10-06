export type FixtureMode = 'GROUPS_THEN_ELIMINATION' | 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' | 'OPEN_COURT';

export const FIXTURE_MODES: FixtureMode[] = [
  'GROUPS_THEN_ELIMINATION',
  'SINGLE_ELIMINATION',
  'ROUND_ROBIN',
  'OPEN_COURT',
];

export type BracketTeam = {
  id: string;
  name: string;
  seedPoints: number;
  order: number;
};

export type GroupPlan = { code: string; teams: BracketTeam[] };

export type KnockoutEntrant = {
  source: string | null;
  label: string;
  team: BracketTeam | null;
  group: string | null;
  rank: number | null;
};

export type SetScore = { teamA: number; teamB: number };

export type GroupMatchResult = {
  teamA: string;
  teamB: string;
  winner: string | null;
  sets: SetScore[];
  walkover?: boolean;
};

export type GroupStandingRow = {
  registrationId: string;
  played: number;
  wins: number;
  losses: number;
  walkoverLosses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
  position: number;
};

export const QUALIFIERS_PER_GROUP = 2;
export const MIN_TEAMS_FOR_GROUPS = 4;
export const BYE_SOURCE = 'BYE';

const WIN_POINTS = 2;
const LOSS_POINTS = 1;
const WALKOVER_GAMES = 12;

export function formatToMode(format?: string | null): FixtureMode {
  switch (String(format || '').toUpperCase()) {
    case 'SINGLE_ELIMINATION':
      return 'SINGLE_ELIMINATION';
    case 'OPEN_COURT':
      return 'OPEN_COURT';
    case 'ROUND_ROBIN':
    case 'LEAGUE':
      return 'ROUND_ROBIN';
    default:
      return 'GROUPS_THEN_ELIMINATION';
  }
}

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** Orden clásico de siembra: devuelve el número de cabeza de serie (1-based) de cada posición. */
export function standardSeedOrder(size: number): number[] {
  if (size < 2) return [1];
  let order = [1, 2];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((seed) => [seed, next + 1 - seed]);
  }
  return order;
}

export function rankTeams(teams: BracketTeam[]): BracketTeam[] {
  return [...teams].sort((a, b) => b.seedPoints - a.seedPoints || a.order - b.order);
}

export function groupCode(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let n = index;
  let code = '';
  do {
    code = letters[n % 26] + code;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return code;
}

/**
 * Zonas de 3 (las que sobran pasan a 4), repartidas en serpentina para que cada zona
 * reciba una cabeza de serie. Con menos de 6 parejas se juega una zona única.
 */
export function planGroups(ranked: BracketTeam[]): GroupPlan[] {
  const n = ranked.length;
  if (n < 6) return [{ code: 'A', teams: [...ranked] }];

  const groupCount = Math.floor(n / 3);
  const fourTeamGroups = n - groupCount * 3;
  const capacity = Array.from({ length: groupCount }, (_, i) =>
    i >= groupCount - fourTeamGroups ? 4 : 3,
  );
  const groups: GroupPlan[] = capacity.map((_, i) => ({ code: groupCode(i), teams: [] }));

  let cursor = 0;
  for (let row = 0; cursor < n; row++) {
    const indexes = groups.map((_, i) => i);
    if (row % 2 === 1) indexes.reverse();
    for (const gi of indexes) {
      if (cursor >= n) break;
      if (groups[gi].teams.length < capacity[gi]) groups[gi].teams.push(ranked[cursor++]);
    }
  }
  return groups;
}

export type ZoneDraftEntry = { teamId: string; group: string; slot: number };

/**
 * Zonas armadas a mano por el organizador. Las parejas aprobadas después del borrador
 * entran en la zona más chica; las que ya no están aprobadas se descartan. Las zonas
 * quedan renombradas A, B, C… en orden y cada una necesita al menos 2 parejas.
 */
export function applyZoneDraft(ranked: BracketTeam[], draft: ZoneDraftEntry[]): GroupPlan[] {
  const byId = new Map(ranked.map((t) => [t.id, t]));
  const buckets = new Map<string, ZoneDraftEntry[]>();
  for (const entry of draft) {
    if (!byId.has(entry.teamId)) continue;
    const list = buckets.get(entry.group) ?? [];
    list.push(entry);
    buckets.set(entry.group, list);
  }

  const codes = [...buckets.keys()].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const groups: GroupPlan[] = codes.map((code) => ({
    code,
    teams: buckets
      .get(code)!
      .sort((a, b) => a.slot - b.slot)
      .map((e) => byId.get(e.teamId)!),
  }));

  const placed = new Set(groups.flatMap((g) => g.teams.map((t) => t.id)));
  for (const team of ranked) {
    if (placed.has(team.id)) continue;
    if (!groups.length) groups.push({ code: 'A', teams: [] });
    const smallest = groups.reduce((min, g) => (g.teams.length < min.teams.length ? g : min));
    smallest.teams.push(team);
  }

  const result = groups
    .filter((g) => g.teams.length > 0)
    .map((g, i) => ({ code: groupCode(i), teams: g.teams }));
  const tooSmall = result.find((g) => g.teams.length < 2);
  if (tooSmall) {
    throw new Error(`La Zona ${tooSmall.code} tiene una sola pareja: necesita al menos 2.`);
  }
  return result;
}

/** Método del círculo: cada fecha con todos los cruces posibles sin repetir pareja. */
export function roundRobinRounds<T>(teams: T[]): Array<Array<[T, T]>> {
  if (teams.length < 2) return [];
  const slots: Array<T | null> = teams.length % 2 === 1 ? [...teams, null] : [...teams];
  const total = slots.length;
  const rounds: Array<Array<[T, T]>> = [];
  let arr = slots;
  for (let r = 0; r < total - 1; r++) {
    const pairs: Array<[T, T]> = [];
    for (let i = 0; i < total / 2; i++) {
      const a = arr[i];
      const b = arr[total - 1 - i];
      if (a !== null && b !== null) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    const [fixed, ...rest] = arr;
    rest.unshift(rest.pop() as T | null);
    arr = [fixed, ...rest];
  }
  return rounds;
}

export function groupSource(code: string, position: number): string {
  return `GROUP:${code}:${position}`;
}

export function parseGroupSource(source?: string | null): { group: string; position: number } | null {
  const match = /^GROUP:([A-Z]+):(\d+)$/.exec(source || '');
  return match ? { group: match[1], position: Number(match[2]) } : null;
}

export function sourceLabel(source?: string | null): string | null {
  if (!source) return null;
  if (source === BYE_SOURCE) return 'BYE';
  const parsed = parseGroupSource(source);
  return parsed ? `${parsed.position}° Zona ${parsed.group}` : null;
}

/** 1° de cada zona primero (en orden de zona), después los 2° — así los ganadores reciben los byes. */
export function groupQualifierEntrants(
  groups: GroupPlan[],
  perGroup = QUALIFIERS_PER_GROUP,
): KnockoutEntrant[] {
  const entrants: KnockoutEntrant[] = [];
  for (let rank = 1; rank <= perGroup; rank++) {
    for (const g of groups) {
      if (g.teams.length < rank) continue;
      const source = groupSource(g.code, rank);
      entrants.push({ source, label: sourceLabel(source)!, team: null, group: g.code, rank });
    }
  }
  return entrants;
}

export function teamEntrants(ranked: BracketTeam[]): KnockoutEntrant[] {
  return ranked.map((team) => ({ source: null, label: team.name, team, group: null, rank: null }));
}

/**
 * Ubica a los clasificados en el cuadro: los byes quedan para las mejores cabezas de serie
 * (nunca BYE contra BYE) y el 1° y 2° de una misma zona van a mitades opuestas.
 */
export function placeEntrants(entrants: KnockoutEntrant[]): Array<KnockoutEntrant | null> {
  if (entrants.length < 2) throw new Error('Se necesitan al menos 2 clasificados para el cuadro');
  const size = nextPowerOfTwo(entrants.length);
  const slots = standardSeedOrder(size).map((seed) => entrants[seed - 1] ?? null);
  separateGroupMates(slots);
  return slots;
}

function separateGroupMates(slots: Array<KnockoutEntrant | null>) {
  const half = slots.length / 2;
  if (half < 1) return;
  const halfOf = (idx: number) => (idx < half ? 0 : 1);
  const indexOf = (group: string, rank: number) =>
    slots.findIndex((s) => s?.group === group && s.rank === rank);

  const groups = [...new Set(slots.map((s) => s?.group).filter(Boolean) as string[])];
  for (let pass = 0; pass < groups.length + 1; pass++) {
    let changed = false;
    for (const g of groups) {
      const first = indexOf(g, 1);
      const second = indexOf(g, 2);
      if (first < 0 || second < 0 || halfOf(first) !== halfOf(second)) continue;
      const targetHalf = 1 - halfOf(first);
      const swapIdx = slots.findIndex((s, idx) => {
        if (!s || s.rank !== 2 || halfOf(idx) !== targetHalf || !s.group) return false;
        const otherFirst = indexOf(s.group, 1);
        return otherFirst < 0 || halfOf(otherFirst) !== halfOf(first);
      });
      if (swapIdx < 0) continue;
      [slots[second], slots[swapIdx]] = [slots[swapIdx], slots[second]];
      changed = true;
    }
    if (!changed) break;
  }
}

export function knockoutRoundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  const labels = ['Final', 'Semifinal', 'Cuartos', 'Octavos', '16avos', '32avos', '64avos'];
  return labels[fromFinal] ?? `Ronda ${round}`;
}

/** Puesto en el ranking del circuito de quien pierde en la ronda que está a `fromFinal` rondas de la final. */
export function knockoutLoserPlacement(fromFinal: number): string {
  const placements = ['FINALIST', 'SEMI', 'QUARTERS', 'R16', 'R32', 'R64'];
  return placements[Math.min(fromFinal, placements.length - 1)];
}

export function validateSets(sets: SetScore[] | undefined): { setsA: number; setsB: number } {
  if (!Array.isArray(sets) || !sets.length) throw new Error('Cargá al menos un set');
  if (sets.length > 5) throw new Error('Máximo 5 sets por partido');
  let setsA = 0;
  let setsB = 0;
  for (const [i, set] of sets.entries()) {
    const a = Number(set?.teamA);
    const b = Number(set?.teamB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99 || b > 99) {
      throw new Error(`El set ${i + 1} tiene un resultado inválido`);
    }
    if (a === b) throw new Error(`El set ${i + 1} no puede terminar empatado`);
    if (a > b) setsA++;
    else setsB++;
  }
  if (setsA === setsB) throw new Error('El partido necesita un ganador: revisá los sets');
  return { setsA, setsB };
}

function gamesOf(result: GroupMatchResult, side: 'A' | 'B'): number {
  if (result.walkover && !result.sets.length) {
    const sideId = side === 'A' ? result.teamA : result.teamB;
    return result.winner === sideId ? WALKOVER_GAMES : 0;
  }
  return result.sets.reduce((sum, s) => sum + (side === 'A' ? s.teamA : s.teamB), 0);
}

function setsOf(result: GroupMatchResult, side: 'A' | 'B'): number {
  if (result.walkover && !result.sets.length) {
    const sideId = side === 'A' ? result.teamA : result.teamB;
    return result.winner === sideId ? 2 : 0;
  }
  return result.sets.filter((s) => (side === 'A' ? s.teamA > s.teamB : s.teamB > s.teamA)).length;
}

/**
 * Tabla de zona: 2 pts por partido ganado, 1 por perdido jugado, 0 por W.O.
 * Desempate: entre dos, el resultado entre ellos; entre tres o más, diferencia de sets,
 * diferencia de games, games a favor y finalmente la siembra.
 */
export function computeGroupStandings(
  teamIdsInSeedOrder: string[],
  results: GroupMatchResult[],
): GroupStandingRow[] {
  const rows = new Map<string, GroupStandingRow>();
  for (const id of teamIdsInSeedOrder) {
    rows.set(id, {
      registrationId: id,
      played: 0,
      wins: 0,
      losses: 0,
      walkoverLosses: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      points: 0,
      position: 0,
    });
  }

  const headToHead = new Map<string, string>();
  for (const r of results) {
    const a = rows.get(r.teamA);
    const b = rows.get(r.teamB);
    if (!a || !b || !r.winner) continue;
    const sA = setsOf(r, 'A');
    const sB = setsOf(r, 'B');
    const gA = gamesOf(r, 'A');
    const gB = gamesOf(r, 'B');
    a.played++;
    b.played++;
    a.setsWon += sA;
    a.setsLost += sB;
    b.setsWon += sB;
    b.setsLost += sA;
    a.gamesWon += gA;
    a.gamesLost += gB;
    b.gamesWon += gB;
    b.gamesLost += gA;
    const [winner, loser] = r.winner === r.teamA ? [a, b] : [b, a];
    winner.wins++;
    winner.points += WIN_POINTS;
    loser.losses++;
    if (r.walkover) loser.walkoverLosses++;
    else loser.points += LOSS_POINTS;
    headToHead.set(`${r.teamA}|${r.teamB}`, r.winner);
    headToHead.set(`${r.teamB}|${r.teamA}`, r.winner);
  }

  const seedIndex = new Map(teamIdsInSeedOrder.map((id, i) => [id, i]));
  const byStats = (x: GroupStandingRow, y: GroupStandingRow) =>
    y.setsWon - y.setsLost - (x.setsWon - x.setsLost) ||
    y.gamesWon - y.gamesLost - (x.gamesWon - x.gamesLost) ||
    y.gamesWon - x.gamesWon ||
    (seedIndex.get(x.registrationId) ?? 0) - (seedIndex.get(y.registrationId) ?? 0);

  const sorted = [...rows.values()].sort((x, y) => y.points - x.points);
  const ordered: GroupStandingRow[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j].points === sorted[i].points) j++;
    const tied = sorted.slice(i, j);
    if (tied.length === 2) {
      const winner = headToHead.get(`${tied[0].registrationId}|${tied[1].registrationId}`);
      if (winner === tied[1].registrationId) tied.reverse();
      else if (!winner) tied.sort(byStats);
    } else if (tied.length > 2) {
      tied.sort(byStats);
    }
    ordered.push(...tied);
    i = j;
  }
  return ordered.map((row, idx) => ({ ...row, position: idx + 1 }));
}
