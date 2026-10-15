import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateChallengeDto {
  /** Rival principal (quien acepta o rechaza el desafío). */
  @IsUUID()
  challengedUserId: string;

  /** Compañero del desafiante: los desafíos son siempre 2 vs 2. */
  @IsUUID()
  partnerUserId: string;

  /** Compañero del rival. Si falta, lo elige el rival al aceptar. */
  @IsOptional()
  @IsUUID()
  challengedPartnerUserId?: string;

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
  /** Obligatorio solo si el desafiante no eligió al compañero del rival. */
  @IsOptional()
  @IsUUID()
  partnerUserId?: string;

  @IsOptional()
  @IsDateString()
  proposedDate?: string;
}
