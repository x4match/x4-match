import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateCourtScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsNumber()
  @Min(0)
  @Max(23.5)
  startHour: number;

  @IsNumber()
  @Min(0.5)
  @Max(24)
  endHour: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
