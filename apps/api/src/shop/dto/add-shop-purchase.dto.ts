import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AddShopPurchaseDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}
