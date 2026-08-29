import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectMatchResultDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;
}
