import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CIRCUIT_CATEGORY_GENDER_OPTIONS, type CircuitCategoryGender } from './add-circuit-category.dto';

export const CIRCUIT_PLAYER_STATUSES = ['ACTIVE', 'PENDING', 'INACTIVE'] as const;
export type CircuitPlayerStatus = (typeof CIRCUIT_PLAYER_STATUSES)[number];

export const LEVEL_CHANGE_REASONS = ['CORRECTION', 'PROMOTION', 'RELEGATION'] as const;
export type LevelChangeReason = (typeof LEVEL_CHANGE_REASONS)[number];

export const SPONSOR_TIERS = ['MAIN', 'GOLD', 'SILVER', 'SUPPORT'] as const;
export type SponsorTier = (typeof SPONSOR_TIERS)[number];

export class CreateCircuitPlayerDto {
  /** Jugador con cuenta x4match: toma nombre y categoría (por rating) de su perfil. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsIn(CIRCUIT_CATEGORY_GENDER_OPTIONS)
  gender?: CircuitCategoryGender;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  level?: number;
}

export class UpdateCircuitPlayerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsIn(CIRCUIT_CATEGORY_GENDER_OPTIONS)
  gender?: CircuitCategoryGender;

  @IsOptional()
  @IsIn(CIRCUIT_PLAYER_STATUSES)
  status?: CircuitPlayerStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SetCircuitPlayerLevelDto {
  @IsInt()
  @Min(1)
  @Max(8)
  level!: number;

  @IsOptional()
  @IsIn(LEVEL_CHANGE_REASONS)
  reason?: LevelChangeReason;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class LevelChangeItemDto {
  @IsUUID()
  playerId!: string;

  @IsInt()
  @Min(1)
  @Max(8)
  toLevel!: number;

  @IsIn(LEVEL_CHANGE_REASONS)
  reason!: LevelChangeReason;
}

export class ApplyLevelChangesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LevelChangeItemDto)
  changes!: LevelChangeItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateCircuitNewsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class UpdateCircuitNewsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class CreateCircuitSponsorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsIn(SPONSOR_TIERS)
  tier?: SponsorTier;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCircuitSponsorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsIn(SPONSOR_TIERS)
  tier?: SponsorTier;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
