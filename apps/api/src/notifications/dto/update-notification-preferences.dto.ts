import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PLAYER_CATEGORY_CODES } from '../../common/utils/level-range.util';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  matches?: boolean;

  @IsOptional()
  @IsBoolean()
  nearby_matches?: boolean;

  /** Categorías de las que querés recibir avisos de partidos cercanos. Vacío = tu categoría. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(PLAYER_CATEGORY_CODES, { each: true })
  nearby_match_categories?: string[];

  @IsOptional()
  @IsBoolean()
  chat?: boolean;

  @IsOptional()
  @IsBoolean()
  tournaments?: boolean;

  @IsOptional()
  @IsBoolean()
  social?: boolean;

  @IsOptional()
  @IsBoolean()
  club_offers?: boolean;

  @IsOptional()
  @IsBoolean()
  achievements?: boolean;
}
