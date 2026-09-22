import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CircuitPointRuleItemDto {
  @IsString()
  placement!: string;

  @IsInt()
  @Min(0)
  points!: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpsertCircuitPointRulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CircuitPointRuleItemDto)
  rules!: CircuitPointRuleItemDto[];
}

export class PublishCircuitStageDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxTeams?: number;

  @IsOptional()
  @IsString()
  format?: string;
}

export class CircuitEventVenueDto {
  @IsUUID()
  clubId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  courtsCount?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateCircuitEventDto {
  @IsString()
  name!: string;

  /** @deprecated Prefer venues[]. Kept for backwards compatibility. */
  @IsOptional()
  @IsUUID()
  clubId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CircuitEventVenueDto)
  venues?: CircuitEventVenueDto[];

  @IsString()
  startDate!: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxTeams?: number;

  @IsOptional()
  @IsString()
  format?: string;

  /** Si true, crea torneo abierto por cada categoría al instante. */
  @IsOptional()
  publishTournaments?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  matchDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  dayStartHour?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  dayEndHour?: number;
}

export class PreviewEventScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  matchDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  dayStartHour?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  dayEndHour?: number;

  @IsOptional()
  @IsBoolean()
  strictAvailability?: boolean;

  @IsOptional()
  @IsBoolean()
  resetExisting?: boolean;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class EnsureEventBracketsDto {
  @IsOptional()
  @IsString()
  mode?: 'OPEN_COURT' | 'SINGLE_ELIMINATION' | 'ROUND_ROBIN';
}

export class UpdateMatchScheduleDto {
  @IsUUID()
  clubId!: string;

  @IsString()
  courtLabel!: string;

  @IsString()
  scheduledAt!: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class RegistrationAvailabilitySlotDto {
  @IsString()
  dayDate!: string;

  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @IsInt()
  @Min(1)
  @Max(24)
  endHour!: number;

  @IsOptional()
  @IsUUID()
  preferredClubId?: string;
}

export class SetRegistrationAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistrationAvailabilitySlotDto)
  slots!: RegistrationAvailabilitySlotDto[];
}
