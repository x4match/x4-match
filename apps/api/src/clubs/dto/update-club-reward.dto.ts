import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

function optionalNullableInt({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return value === '' ? null : value;
  return Number(value);
}

export class UpdateClubRewardDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pointsRequired?: number;

  @IsOptional()
  @IsIn(['BENEFIT', 'DISCOUNT', 'FREE_SLOT', 'MERCH'])
  rewardType?: 'BENEFIT' | 'DISCOUNT' | 'FREE_SLOT' | 'MERCH';

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(optionalNullableInt)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  stock?: number | null;

  @IsOptional()
  @Transform(optionalNullableInt)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  maxPerUser?: number | null;
}
