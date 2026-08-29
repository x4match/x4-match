import { BadRequestException } from '@nestjs/common';

export type SetScore = { teamA: number; teamB: number };

export type ParsedBestOfThree = {
  winnerTeam: 'A' | 'B';
  setsWonA: number;
  setsWonB: number;
  sets: SetScore[];
  scoreSummary: string;
};

function setWinner(set: SetScore): 'A' | 'B' | null {
  if (set.teamA === set.teamB) return null;
  return set.teamA > set.teamB ? 'A' : 'B';
}

export function parseBestOfThreeSets(sets: SetScore[]): ParsedBestOfThree {
  if (sets.length < 2 || sets.length > 3) {
    throw new BadRequestException('El partido se juega al mejor de 3 sets (ingresá 2 o 3 sets)');
  }

  let setsWonA = 0;
  let setsWonB = 0;

  for (const set of sets) {
    if (set.teamA < 0 || set.teamB < 0) {
      throw new BadRequestException('Los juegos de un set no pueden ser negativos');
    }
    const winner = setWinner(set);
    if (!winner) {
      throw new BadRequestException('Cada set debe tener un ganador (no puede haber empate)');
    }
    if (winner === 'A') setsWonA += 1;
    else setsWonB += 1;
  }

  if (sets.length === 2 && setsWonA === 1 && setsWonB === 1) {
    throw new BadRequestException('Con empate 1-1 en sets tenés que cargar el tercer set');
  }

  if (setsWonA === 2) {
    return buildParsed('A', setsWonA, setsWonB, sets);
  }
  if (setsWonB === 2) {
    return buildParsed('B', setsWonA, setsWonB, sets);
  }

  throw new BadRequestException(
    'El marcador no define un ganador al mejor de 3 sets (se necesitan 2 sets ganados)',
  );
}

function buildParsed(
  winnerTeam: 'A' | 'B',
  setsWonA: number,
  setsWonB: number,
  sets: SetScore[],
): ParsedBestOfThree {
  const setDetail = sets.map((s) => `${s.teamA}-${s.teamB}`).join(', ');
  return {
    winnerTeam,
    setsWonA,
    setsWonB,
    sets,
    scoreSummary: `${setsWonA}-${setsWonB} (${setDetail})`,
  };
}

export function userTeamFromRank(rnk: number, neededPlayers: number): 'A' | 'B' {
  const half = Math.ceil(Math.max(neededPlayers, 2) / 2);
  return rnk <= half ? 'A' : 'B';
}
