import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTournamentPhotoDto {
  @IsString()
  photoUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}
