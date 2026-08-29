import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

class CheckoutItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

export class CheckoutShopDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsOptional()
  @IsUUID()
  matchId?: string;
}
