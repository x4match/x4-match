import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class StartLiveScoreDto {
  @IsOptional()
  @IsIn(['advantage', 'golden'])
  deuceMode?: 'advantage' | 'golden';

  @IsOptional()
  @IsBoolean()
  superTiebreak?: boolean;
}
