import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  matches?: boolean;

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
