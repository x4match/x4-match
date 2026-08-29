import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'El nombre de usuario solo puede tener letras, números, punto y guión bajo',
  })
  nickname?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  gender?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsUUID()
  mainClubId?: string | null;

  @IsOptional()
  @IsIn(['8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'])
  declaredCategory?: '8va' | '7ma' | '6ta' | '5ta' | '4ta' | '3ra' | '2da' | '1ra' | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}
