import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PlayerRatingDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  comment?: string;
}
