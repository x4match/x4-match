import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

const PRODUCT_KINDS = ['MATCH_ADDON', 'GENERAL'] as const;
const CATEGORIES = ['BALLS', 'DRINKS', 'FOOD', 'RENTAL', 'MERCH', 'OTHER'] as const;

export class CreateShopProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(999999)
  price: number;

  @IsOptional()
  @IsEnum(PRODUCT_KINDS)
  kind?: 'MATCH_ADDON' | 'GENERAL';

  @IsOptional()
  @IsEnum(CATEGORIES)
  category?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
