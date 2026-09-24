import { IsString, MinLength } from 'class-validator';

export class ClaimShopCouponDto {
  @IsString()
  @MinLength(1)
  code: string;
}
