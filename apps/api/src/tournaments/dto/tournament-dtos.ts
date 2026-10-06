import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { FIXTURE_MODES, type FixtureMode } from '../brackets/bracket-engine';

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

  /** Calendario: un día (fecha+hora) o largo (varias jornadas). Independiente del formato. */
  @IsOptional()
  @IsIn(['SINGLE_DAY', 'MULTI_DAY'])
  scheduleType?: 'SINGLE_DAY' | 'MULTI_DAY';

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  clubId?: string;

  /** Sedes del torneo (multi-sede). El primero es la sede principal / validación. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  venueClubIds?: string[];

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
  @IsBoolean()
  acceptTransfer?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptMercadopago?: boolean;

  @IsOptional()
  @IsString()
  transferCbu?: string;

  @IsOptional()
  @IsString()
  transferAlias?: string;

  @IsOptional()
  @IsString()
  transferHolderName?: string;

  /** Devolver la inscripción si la pareja se baja con 24 h de anticipación. */
  @IsOptional()
  @IsBoolean()
  refundOnWithdraw?: boolean;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @IsString()
  prizes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  /** Vínculo opcional a circuito (etapa WPE). */
  @IsOptional()
  @IsUUID()
  circuitId?: string;

  @IsOptional()
  @IsUUID()
  circuitStageId?: string;

  @IsOptional()
  @IsUUID()
  circuitCategoryId?: string;
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
  @IsIn(['SINGLE_DAY', 'MULTI_DAY'])
  scheduleType?: 'SINGLE_DAY' | 'MULTI_DAY';

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  venueClubIds?: string[];

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
  @IsBoolean()
  acceptTransfer?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptMercadopago?: boolean;

  @IsOptional()
  @IsString()
  transferCbu?: string;

  @IsOptional()
  @IsString()
  transferAlias?: string;

  @IsOptional()
  @IsString()
  transferHolderName?: string;

  @IsOptional()
  @IsBoolean()
  refundOnWithdraw?: boolean;

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
  @IsOptional()
  @IsArray()
  sets?: { teamA: number; teamB: number }[];

  /** Partido ganado por W.O.: la pareja indicada gana sin sets. */
  @IsOptional()
  @IsIn(['A', 'B'])
  walkoverWinner?: 'A' | 'B';
}

export class BulkScoreItemDto extends SetScoreDto {
  @IsUUID()
  matchId!: string;
}

export class BulkScoreDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BulkScoreItemDto)
  results!: BulkScoreItemDto[];
}

export class RegistrationWindowDto {
  /** Fecha y hora de cierre programado (ISO). `null` la quita. */
  @IsOptional()
  @IsDateString()
  closesAt?: string | null;

  /** CLOSE: "Cerrar definitivamente". REOPEN: vuelve a abrir la inscripción. */
  @IsOptional()
  @IsIn(['CLOSE', 'REOPEN'])
  action?: 'CLOSE' | 'REOPEN';
}

export class ZoneDraftItemDto {
  @IsString()
  @Matches(/^[A-Z]{1,3}$/)
  code!: string;

  @IsArray()
  @IsUUID('all', { each: true })
  teamIds!: string[];
}

export class SaveZonesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => ZoneDraftItemDto)
  zones!: ZoneDraftItemDto[];
}

export class CloseTournamentDto {
  /** Cancela los partidos sin jugar y cierra igual. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
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

export class CreateTournamentPlayerDto {
  @IsString()
  name!: string;

  @IsIn(['DRIVE', 'REVES'])
  side!: 'DRIVE' | 'REVES';

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class UpdateTournamentPlayerDto {
  @IsIn(['DRIVE', 'REVES'])
  side!: 'DRIVE' | 'REVES';
}

export class CreateTournamentPairDto {
  @IsUUID()
  driveId!: string;

  @IsUUID()
  revesId!: string;
}

export class GenerateFixtureDto {
  /** Si no se envía se usa el formato del torneo. */
  @IsOptional()
  @IsIn(FIXTURE_MODES)
  mode?: FixtureMode;

  @IsOptional()
  @IsBoolean()
  reset?: boolean;

  /** Permite regenerar aunque ya haya resultados cargados (se pierden). */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
