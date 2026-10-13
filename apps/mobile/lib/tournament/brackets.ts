import type { FixtureMode, TournamentMatch } from './types';

export const FIXTURE_MODE_LABELS: Record<FixtureMode, string> = {
  GROUPS_THEN_ELIMINATION: 'Zonas + cuadro',
  SINGLE_ELIMINATION: 'Eliminación directa',
  ROUND_ROBIN: 'Todos contra todos',
  OPEN_COURT: 'Cancha abierta',
};

/** El backend responde 409 con este código cuando regenerar borraría resultados cargados. */
export const FIXTURE_HAS_RESULTS = 'FIXTURE_HAS_RESULTS';

export type EnsureBracketsResult = {
  tournamentId: string;
  categoryLabel: string | null;
  created: number;
  skipped?: string;
  mode?: FixtureMode;
  groups?: number;
  knockoutSize?: number;
  teams?: number;
};

export function describeBracketResult(r: EnsureBracketsResult): string {
  if (r.skipped) return r.skipped;
  if (r.mode === 'GROUPS_THEN_ELIMINATION') {
    return `${r.teams} parejas · ${r.groups} zona${r.groups === 1 ? '' : 's'} + cuadro de ${r.knockoutSize}`;
  }
  if (r.mode === 'SINGLE_ELIMINATION') return `${r.teams} parejas · cuadro de ${r.knockoutSize}`;
  return `${r.teams} parejas · ${r.created} partidos`;
}

export function isByeMatch(m: TournamentMatch): boolean {
  return !!m.score?.bye || m.team_a_source === 'BYE' || m.team_b_source === 'BYE';
}

export function hasBracketPhases(matches: TournamentMatch[] | undefined): boolean {
  return !!matches?.some((m) => m.phase === 'GROUP' || m.phase === 'KNOCKOUT');
}

export function bothTeamsDefined(m: TournamentMatch): boolean {
  return !!m.team_a_registration_id && !!m.team_b_registration_id;
}

export function slotName(m: TournamentMatch, side: 'A' | 'B'): string {
  const name = side === 'A' ? m.team_a_name : m.team_b_name;
  return name?.trim() || 'A definir';
}

export type KnockoutRound = { round: number; label: string; matches: TournamentMatch[] };

export function knockoutRounds(matches: TournamentMatch[]): KnockoutRound[] {
  const byRound = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    if (m.phase !== 'KNOCKOUT') continue;
    byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, list]) => ({
      round,
      label: list[0]?.round_label || `Ronda ${round}`,
      matches: [...list].sort((x, y) => (x.bracket_position ?? 0) - (y.bracket_position ?? 0)),
    }));
}
