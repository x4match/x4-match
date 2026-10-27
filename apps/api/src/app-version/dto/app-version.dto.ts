import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

export const APP_VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value;

export class AppPlatformVersionDto {
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @Matches(APP_VERSION_PATTERN, { message: 'La versión debe tener el formato 1.2.3' })
  latestVersion?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @Matches(APP_VERSION_PATTERN, { message: 'La versión mínima debe tener el formato 1.2.3' })
  minVersion?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @Matches(/^https:\/\/\S+$/i, { message: 'El link de la tienda debe empezar con https://' })
  @MaxLength(500)
  storeUrl?: string | null;
}

export class UpdateAppVersionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AppPlatformVersionDto)
  ios?: AppPlatformVersionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppPlatformVersionDto)
  android?: AppPlatformVersionDto;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  message?: string | null;
}
