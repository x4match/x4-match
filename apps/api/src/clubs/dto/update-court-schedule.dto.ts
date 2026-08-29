import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCourtScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23.5)
  startHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(24)
  endHour?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
