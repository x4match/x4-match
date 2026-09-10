import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginDto {
  @Transform(trimString)
  @IsEmail()
  email: string;

  @Transform(trimString)
  @IsString()
  password: string;
}
