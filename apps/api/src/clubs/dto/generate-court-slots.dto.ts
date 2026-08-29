import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateCourtSlotsDto {
  /** Cuántos días hacia adelante materializar (1–30). Default 7. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  daysAhead?: number;
}
