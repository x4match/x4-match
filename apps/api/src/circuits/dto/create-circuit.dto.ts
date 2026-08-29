import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCircuitDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
  @IsIn(['DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED'])
  status?: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
}
