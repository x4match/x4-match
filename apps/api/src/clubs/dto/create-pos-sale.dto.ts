import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PosSaleItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class CreatePosSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items: PosSaleItemDto[];

  @IsIn(['CASH', 'MP', 'MANUAL', 'OTHER'])
  paymentMethod: 'CASH' | 'MP' | 'MANUAL' | 'OTHER';

  @IsOptional()
  @IsUUID()
  customerUserId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
