import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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
  @IsNumber()
  @Min(8)
  @Max(23.5)
  startHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(8.5)
  @Max(24)
  endHour?: number;

  @IsOptional()
  @IsBoolean()
  isDeadHour?: boolean;

  /** Precio por hora del turno (declarado por el club). */
  @IsOptional()
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
