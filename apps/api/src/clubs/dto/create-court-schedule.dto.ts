import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

function toHourNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.includes(':')) {
      const [hRaw, mRaw = '0'] = trimmed.split(':');
      const h = Number(hRaw);
      const m = Number(mRaw);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
      return h + (m >= 30 ? 0.5 : 0);
    }
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export class CreateCourtScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @Transform(({ value }) => toHourNumber(value))
  @IsNumber()
  @Min(0)
  @Max(23.5)
  startHour: number;

  @Transform(({ value }) => toHourNumber(value))
  @IsNumber()
  @Min(0.5)
  @Max(24)
  endHour: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
