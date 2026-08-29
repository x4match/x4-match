import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  preferredHand?: string | null;

  @IsOptional()
  @IsString()
  courtPosition?: string | null;

  @IsOptional()
  @IsString()
  matchType?: string | null;

  @IsOptional()
  @IsString()
  preferredPlayTime?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availabilityWindows?: string[] | null;
}
