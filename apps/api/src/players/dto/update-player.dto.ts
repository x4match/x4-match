import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdatePlayerDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7)
  level?: number;

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
