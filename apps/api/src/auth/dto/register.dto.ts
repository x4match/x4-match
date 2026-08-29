import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ValidateIf((o: RegisterDto) => (o.role ?? 'PLAYER') === 'PLAYER')
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'El nombre de usuario solo puede tener letras, números, punto y guión bajo',
  })
  nickname?: string;

  @ValidateIf((o: RegisterDto) => (o.role ?? 'PLAYER') === 'PLAYER')
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsIn(['PLAYER', 'CLUB_ADMIN', 'ORGANIZER'])
  role?: 'PLAYER' | 'CLUB_ADMIN' | 'ORGANIZER';

  @IsOptional()
  @IsIn(['8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'])
  declaredCategory?: '8va' | '7ma' | '6ta' | '5ta' | '4ta' | '3ra' | '2da' | '1ra';

  @IsOptional()
  @IsIn(['Masculino', 'Femenino', 'Otro'])
  gender?: 'Masculino' | 'Femenino' | 'Otro';

  @IsOptional()
  @IsString()
  fejubaId?: string;

  @IsOptional()
  @IsString()
  fejubaCategory?: string;
}
