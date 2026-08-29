import { IsInt, Max, Min } from 'class-validator';

export class SetScoreDto {
  @IsInt()
  @Min(0)
  @Max(99)
  teamA: number;

  @IsInt()
  @Min(0)
  @Max(99)
  teamB: number;
}
