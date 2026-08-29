import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
}
