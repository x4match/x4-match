import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelRedemptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
