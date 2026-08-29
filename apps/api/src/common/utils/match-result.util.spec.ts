import { BadRequestException } from '@nestjs/common';
import { parseBestOfThreeSets } from './match-result.util';

describe('parseBestOfThreeSets', () => {
  it('acepta victoria 2-0 en sets', () => {
    const r = parseBestOfThreeSets([
      { teamA: 6, teamB: 4 },
      { teamA: 6, teamB: 3 },
    ]);
    expect(r.winnerTeam).toBe('A');
    expect(r.scoreSummary).toBe('2-0 (6-4, 6-3)');
  });

  it('acepta victoria 2-1 con tercer set', () => {
    const r = parseBestOfThreeSets([
      { teamA: 6, teamB: 4 },
      { teamA: 4, teamB: 6 },
      { teamA: 6, teamB: 2 },
    ]);
    expect(r.winnerTeam).toBe('A');
    expect(r.setsWonA).toBe(2);
    expect(r.setsWonB).toBe(1);
  });

  it('rechaza empate 1-1 sin tercer set', () => {
    expect(() =>
      parseBestOfThreeSets([
        { teamA: 6, teamB: 4 },
        { teamA: 3, teamB: 6 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rechaza set empatado', () => {
    expect(() =>
      parseBestOfThreeSets([
        { teamA: 6, teamB: 6 },
        { teamA: 6, teamB: 4 },
      ]),
    ).toThrow(BadRequestException);
  });
});
