import { IsOptional, IsString, MinLength } from 'class-validator';

export class AppleAuthDto {
  @IsString()
  @MinLength(20)
  identityToken: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}
