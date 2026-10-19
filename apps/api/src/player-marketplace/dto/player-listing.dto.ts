import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';

export const LISTING_CATEGORIES = [
  'PALETAS',
  'ZAPATILLAS',
  'INDUMENTARIA',
  'BOLSOS',
  'PELOTAS',
  'ACCESORIOS',
  'OTROS',
] as const;

export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'USED'] as const;

export const LISTING_EDITABLE_STATUSES = ['ACTIVE', 'PAUSED', 'SOLD'] as const;

export class CreatePlayerListingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(99999999)
  price: number;

  @IsIn(LISTING_CATEGORIES)
  category: (typeof LISTING_CATEGORIES)[number];

  @IsIn(LISTING_CONDITIONS)
  condition: (typeof LISTING_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;
}

export class UpdatePlayerListingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999)
  price?: number;

  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: (typeof LISTING_CATEGORIES)[number];

  @IsOptional()
  @IsIn(LISTING_CONDITIONS)
  condition?: (typeof LISTING_CONDITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsIn(LISTING_EDITABLE_STATUSES)
  status?: (typeof LISTING_EDITABLE_STATUSES)[number];
}

export class RemoveListingPhotoDto {
  @IsString()
  url: string;
}
