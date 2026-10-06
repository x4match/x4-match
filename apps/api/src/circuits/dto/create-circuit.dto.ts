import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const CIRCUIT_SHORT_NAME_PATTERN = /^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ .\-]{0,11}$/;

export class CircuitIdentityFieldsDto {
  @IsOptional()
  @IsString()
  @Matches(CIRCUIT_SHORT_NAME_PATTERN, {
    message: 'La sigla debe tener entre 1 y 12 caracteres (letras, números, espacio, punto o guion)',
  })
  shortName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  season?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @ValidateIf((o: CircuitIdentityFieldsDto) => o.contactEmail !== '')
  @IsEmail({}, { message: 'Email de contacto inválido' })
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  instagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;
}

export class CreateCircuitDto extends CircuitIdentityFieldsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED'])
  status?: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
}

export class UpdateCircuitDto extends CircuitIdentityFieldsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
