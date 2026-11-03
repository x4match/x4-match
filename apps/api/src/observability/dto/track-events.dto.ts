import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AnalyticsEventDto {
  @IsString()
  @Matches(/^[a-z0-9_.:-]{1,64}$/)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  screen?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  /** Momento en que ocurrió en el dispositivo (los eventos se envían en lotes). */
  @IsOptional()
  @IsISO8601()
  at?: string;
}

export class TrackEventsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events: AnalyticsEventDto[];
}
