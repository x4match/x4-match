import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ClubSubscriptionPlan } from '../../common/utils/club-plan.util';

const CLUB_PLANS = ['BASIC', 'GROWTH', 'PRO'] as const;

export class UpdateClubDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  /** Plan del club: define multiplicador en horarios promocionales (GROWTH x1.5, PRO x2). */
  @IsOptional()
  @IsEnum(CLUB_PLANS)
  subscriptionPlan?: ClubSubscriptionPlan;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** Tarifa base por hora de cancha (sugerida al publicar turnos). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  courtPricePerHour?: number;

  /**
   * % del valor del turno que cada jugador paga para confirmar/reservar la cancha.
   * 100 = cobro completo · 25/50 = seña. El pago “turno completo” sigue cubriendo el 100%.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  depositPercent?: number;
}
