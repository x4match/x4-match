import {
  positionsAreCompatible,
  oppositePosition,
  normalizePosition,
} from './challenge.util';

describe('challenge positions', () => {
  it('normaliza drive/revés/ambos', () => {
    expect(normalizePosition('drive')).toBe('drive');
    expect(normalizePosition('revés')).toBe('reves');
    expect(normalizePosition('ambos')).toBe('ambos');
  });

  it('exige lados opuestos salvo ambos o sin dato', () => {
    expect(positionsAreCompatible('drive', 'reves')).toBe(true);
    expect(positionsAreCompatible('drive', 'drive')).toBe(false);
    expect(positionsAreCompatible('drive', 'ambos')).toBe(true);
    expect(positionsAreCompatible(null, 'drive')).toBe(true);
  });

  it('calcula lado opuesto', () => {
    expect(oppositePosition('drive')).toBe('reves');
    expect(oppositePosition('reves')).toBe('drive');
    expect(oppositePosition('ambos')).toBeNull();
  });
});
