import { IsInt, Min } from 'class-validator';

export class SubmitResultDto {
  @IsInt()
  @Min(0)
  teamAScore: number;

  @IsInt()
  @Min(0)
  teamBScore: number;
}

