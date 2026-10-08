import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class LiveScorePointDto {
  @IsIn(['A', 'B'])
  team: 'A' | 'B';

  /** Versión del marcador que vio el cliente; si cambió, se rechaza el punto. */
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class LiveScoreUndoDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}
