import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const CIRCUIT_CATEGORY_GENDER_OPTIONS = ['Caballeros', 'Damas'] as const;
export type CircuitCategoryGender = (typeof CIRCUIT_CATEGORY_GENDER_OPTIONS)[number];

export class AddCircuitCategoryDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsIn(CIRCUIT_CATEGORY_GENDER_OPTIONS)
  gender?: CircuitCategoryGender;

  sortOrder?: number;
}
