import { IsInt, Min } from 'class-validator';

export class UpdateShopStockDto {
  @IsInt()
  @Min(0)
  stockQuantity: number;
}
