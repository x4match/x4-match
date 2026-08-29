import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  name!: string;

  @IsIn(['INTERNAL', 'EXTERNAL'])
  modality!: 'INTERNAL' | 'EXTERNAL';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxTeams?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  courtsAvailable?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @IsString()
  prizes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateTournamentInvitesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds!: string[];
}

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxTeams?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  courtsAvailable?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @IsString()
  prizes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateTournamentDateDto {
  @IsString()
  playDate!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRegistrationDto {
  @IsString()
  player1Name!: string;

  @IsString()
  player2Name!: string;

  @IsOptional()
  @IsString()
  player1UserId?: string;

  @IsOptional()
  @IsString()
  player2UserId?: string;

  @IsOptional()
  @IsEmail()
  player1Email?: string;

  @IsOptional()
  @IsEmail()
  player2Email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  category?: string;

  // El organizador inscribe a la pareja en nombre de otros (no juega él mismo)
  @IsOptional()
  @IsBoolean()
  onBehalf?: boolean;
}

export class CreateTournamentMatchDto {
  @IsOptional()
  @IsString()
  teamARegistrationId?: string;

  @IsOptional()
  @IsString()
  teamBRegistrationId?: string;

  @IsOptional()
  @IsString()
  teamAName?: string;

  @IsOptional()
  @IsString()
  teamBName?: string;

  @IsOptional()
  @IsInt()
  round?: number;

  @IsOptional()
  @IsString()
  roundLabel?: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  courtLabel?: string;

  @IsOptional()
  @IsString()
  dateId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class SetScoreDto {
  @IsArray()
  sets!: { teamA: number; teamB: number }[];
}

export class UpdateMatchDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  courtLabel?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  dateId?: string;
}

export class GenerateFixtureDto {
  @IsOptional()
  @IsString()
  mode?: 'ROUND_ROBIN' | 'SINGLE_ELIMINATION' | 'OPEN_COURT';

  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}
