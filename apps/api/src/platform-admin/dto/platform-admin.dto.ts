import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOpsUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}

export class UpdateUserRoleDto {
  @IsIn(['PLAYER', 'CLUB_ADMIN', 'ORGANIZER', 'SUPER_ADMIN'])
  role!: 'PLAYER' | 'CLUB_ADMIN' | 'ORGANIZER' | 'SUPER_ADMIN';
}

export class StartClubTrialDto {
  @IsIn(['TIME', 'MANUAL'])
  mode!: 'TIME' | 'MANUAL';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class UpdateChecklistItemDto {
  @IsString()
  key!: string;

  @IsBoolean()
  done!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ExtendTrialDto {
  @IsInt()
  @Min(1)
  @Max(180)
  extraDays!: number;
}

export class SuspendClubDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class OpsNotesDto {
  @IsString()
  notes!: string;
}
