import { IsString, Matches } from 'class-validator';

export class FejubaLookupDto {
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni: string;
}
