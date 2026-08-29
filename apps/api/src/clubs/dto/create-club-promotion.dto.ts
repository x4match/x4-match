import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateClubPromotionDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsNumber()
  @Min(0)
  @Max(23.5)
  startHour: number;

  @IsNumber()
  @Min(0.5)
  @Max(24)
  endHour: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  bonusPoints?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
