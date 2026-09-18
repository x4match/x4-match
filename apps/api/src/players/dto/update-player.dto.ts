import {
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdatePlayerDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsIn(['drive', 'reves', 'ambos'])
  position?: 'drive' | 'reves' | 'ambos';

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
