import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const ASSIGNABLE_ROLES = ['ADMIN', 'REFEREE', 'STAFF'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export class InviteCircuitStaffDto {
  @IsUUID()
  userId: string;

  @IsIn(ASSIGNABLE_ROLES, { message: 'Rol inválido (ADMIN, REFEREE o STAFF)' })
  role: AssignableRole;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;
}

export class UpdateCircuitStaffDto {
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES, { message: 'Rol inválido (ADMIN, REFEREE o STAFF)' })
  role?: AssignableRole;

  /** String vacío = volver al título automático (rol + sigla del circuito). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;
}

export class TransferCircuitPresidencyDto {
  @IsUUID()
  @IsNotEmpty()
  memberId: string;
}
