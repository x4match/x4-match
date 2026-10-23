import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateSlotOfferSettingsDto {
  /** Radio en km alrededor del club para "Avisar jugadores" (1–50). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  radiusKm: number;
}
