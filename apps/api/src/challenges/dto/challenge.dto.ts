import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateChallengeDto {
  @IsUUID()
  challengerClubId: string;

  @IsUUID()
  challengedClubId: string;

  @IsUUID()
  partnerUserId: string;

  @IsOptional()
  @IsDateString()
  proposedDate?: string;
}

export class AcceptChallengeDto {
  @IsUUID()
  partnerUserId: string;

  @IsOptional()
  @IsDateString()
  proposedDate?: string;
}
