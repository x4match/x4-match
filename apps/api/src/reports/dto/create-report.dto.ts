import { IsString, IsOptional } from 'class-validator';

export class CreateReportDto {
  @IsString()
  reportedUserId: string;

  @IsOptional()
  @IsString()
  matchId?: string;

  @IsString()
  reason: string;
}

