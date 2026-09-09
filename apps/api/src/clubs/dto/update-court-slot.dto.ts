import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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

export class UpdateCourtSlotDto {
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @IsOptional()
  @IsString()
  courtLabel?: string;

  @IsOptional()
  @IsString()
  slotDate?: string;

  @IsOptional()
  @Transform(({ value }) => toHourNumber(value))
  @IsNumber()
  @Min(8)
  @Max(23.5)
  startHour?: number;

  @IsOptional()
  @Transform(({ value }) => toHourNumber(value))
  @IsNumber()
  @Min(8.5)
  @Max(24)
  endHour?: number;

  @IsOptional()
  @IsBoolean()
  isDeadHour?: boolean;

  /** Precio por hora del turno (declarado por el club). */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  pricePerHour?: number;

  /** OPEN | BLOCKED | MAINTENANCE — no usar para BOOKED (se reserva vía partidos). */
  @IsOptional()
  @IsIn(['OPEN', 'BLOCKED', 'MAINTENANCE'])
  status?: 'OPEN' | 'BLOCKED' | 'MAINTENANCE';

  @IsOptional()
  @IsString()
  blockReason?: string;
}
