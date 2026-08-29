import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateShopCouponDto {
  @IsString()
  code: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsCost?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}
