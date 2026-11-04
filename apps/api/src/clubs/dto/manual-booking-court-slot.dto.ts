import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ManualBookingCourtSlotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
