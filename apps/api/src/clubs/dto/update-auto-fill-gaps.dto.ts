import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAutoFillGapsDto {
  @IsBoolean()
  enabled: boolean;

  /** Horas antes del turno para actuar (1–72). Default 8. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  hoursBefore?: number;

  /** Si true, crea un partido abierto y reserva el slot. */
  @IsOptional()
  @IsBoolean()
  autoCreateMatch?: boolean;

  /** Si true, notifica candidatos (aunque no cree partido). */
  @IsOptional()
  @IsBoolean()
  notifyEnabled?: boolean;
}
