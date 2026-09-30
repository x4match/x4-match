import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateChallengeDto {
  /** Jugador al que se desafía. Solo tiene que existir en la app. */
  @IsUUID()
  challengedUserId: string;

  /** Opcional: sin compañero el desafío es 1v1. */
  @IsOptional()
  @IsUUID()
  partnerUserId?: string;

  /** @deprecated Se toma del club principal del desafiante. */
  @IsOptional()
  @IsUUID()
  challengerClubId?: string;

  /** @deprecated Se toma del club principal del rival. */
  @IsOptional()
  @IsUUID()
  challengedClubId?: string;

  @IsOptional()
  @IsDateString()
  proposedDate?: string;
}

export class AcceptChallengeDto {
  /** Obligatorio solo si el desafiante eligió compañero (2v2). */
  @IsOptional()
  @IsUUID()
  partnerUserId?: string;

  @IsOptional()
  @IsDateString()
  proposedDate?: string;
}
