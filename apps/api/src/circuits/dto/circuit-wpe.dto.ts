import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

export class CreateCircuitEventDto {
  @IsString()
  name!: string;

  @IsUUID()
  clubId!: string;

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
}
