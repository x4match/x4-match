import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateShopProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsIn(['MATCH_ADDON', 'GENERAL'])
  kind?: 'MATCH_ADDON' | 'GENERAL';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  availableAsMatchExtra?: boolean;
}
