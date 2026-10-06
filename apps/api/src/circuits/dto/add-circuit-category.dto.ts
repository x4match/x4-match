import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export const CIRCUIT_CATEGORY_GENDER_OPTIONS = ['Caballeros', 'Damas'] as const;
export type CircuitCategoryGender = (typeof CIRCUIT_CATEGORY_GENDER_OPTIONS)[number];

export const CIRCUIT_CATEGORY_KINDS = ['FIXED', 'SUM', 'OPEN'] as const;

export class AddCircuitCategoryDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsIn(CIRCUIT_CATEGORY_GENDER_OPTIONS)
  gender?: CircuitCategoryGender;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  /** Si no se indica se deduce de la etiqueta ("4ta" → nivel 4, "Suma 7" → suma 7). */
  @IsOptional()
  @IsIn(CIRCUIT_CATEGORY_KINDS)
  kind?: (typeof CIRCUIT_CATEGORY_KINDS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(16)
  sumTotal?: number;
}
