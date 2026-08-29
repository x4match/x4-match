import type { PlayerCategory } from '../../common/utils';

export type FejubaGenderHint = 'Masculino' | 'Femenino';

export type FejubaMatch = {
  fejubaId: string;
  fullName: string;
  category: PlayerCategory | null;
  rawCategory: string | null;
  genderHint: FejubaGenderHint | null;
};

export type FejubaLookupResult = {
  found: boolean;
  matches: FejubaMatch[];
};
