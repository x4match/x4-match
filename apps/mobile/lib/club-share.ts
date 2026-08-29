export interface RankingShareEntry {
  rank: string | number;
  name: string;
  nickname?: string;
  points: number;
  matches_at_club?: number;
}

export function buildClubRankingShareText(
  clubName: string,
  monthLabel: string,
  entries: RankingShareEntry[],
  limit: number,
) {
  const top = entries.slice(0, limit);
  const lines = top.map((entry) => {
    const displayName = entry.nickname || entry.name;
    const matches =
      entry.matches_at_club != null ? ` · ${entry.matches_at_club} partidos` : '';
    return `#${entry.rank} ${displayName} — ${entry.points} pts${matches}`;
  });

  return [
    `🏆 Ranking mensual — ${clubName}`,
    monthLabel,
    '',
    ...lines,
    '',
    'Sumá puntos jugando en el club. ¿Te animás al top?',
    '',
    '#Padel #Ranking #Club',
  ].join('\n');
}
