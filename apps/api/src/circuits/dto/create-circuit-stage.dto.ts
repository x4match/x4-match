import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCircuitStageDto {
  @IsUUID()
  @IsNotEmpty()
  clubId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
