import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MatchInviteDto } from './match-invite.dto';

export type CourtBookingMode = 'none' | 'external' | 'in_app';

export class CreateMatchDto {
  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsString()
  courtSlotId?: string;

  @IsOptional()
  @IsIn(['none', 'external', 'in_app'])
  courtBooking?: CourtBookingMode;

  @IsOptional()
  @IsString()
  venueNote?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  levelMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  levelMax?: number;

  @IsIn(['male', 'female', 'mixed', 'open'])
  gender: 'male' | 'female' | 'mixed' | 'open';

  @IsIn(['friendly', 'competitive'])
  mode: 'friendly' | 'competitive';

  @IsInt()
  @Min(2)
  @Max(8)
  neededPlayers: number;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MatchInviteDto)
  invites?: MatchInviteDto[];
}
