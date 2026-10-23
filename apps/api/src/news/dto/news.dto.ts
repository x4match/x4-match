import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const NEWS_MAX_DURATION_DAYS = 365;
export const NEWS_MAX_LIVE_PER_CLUB = 100;
export const NEWS_MAX_PENDING_PER_PLAYER = 50;

/** Llega como multipart/form-data junto con la imagen: todos los campos son strings. */
export class CreateNewsPostDto {
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  body?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'El link debe empezar con http:// o https://' })
  @MaxLength(500)
  linkUrl?: string;
}

/** Multipart: la imagen es opcional; un campo vacío en body/linkUrl los borra. */
export class UpdateNewsPostDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;
}

export class CreatePlatformNewsDto extends CreateNewsPostDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_DURATION_DAYS)
  durationDays?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  featured?: boolean;
}

export class ApproveNewsPostDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_DURATION_DAYS)
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

export class SetNewsFeaturedDto {
  @IsBoolean()
  featured!: boolean;
}

export class RejectNewsPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateNewsExpiryDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_DURATION_DAYS)
  durationDays?: number;
}

export class UpdateNewsSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_DURATION_DAYS)
  defaultDurationDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_LIVE_PER_CLUB)
  maxLivePerClub?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_PENDING_PER_PLAYER)
  maxPendingPerPlayer?: number;
}
