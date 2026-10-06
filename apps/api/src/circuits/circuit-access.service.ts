import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export const CIRCUIT_STAFF_ROLES = ['PRESIDENT', 'ADMIN', 'REFEREE', 'STAFF'] as const;
export type CircuitStaffRole = (typeof CIRCUIT_STAFF_ROLES)[number];

export const CIRCUIT_ROLE_LABELS: Record<CircuitStaffRole, string> = {
  PRESIDENT: 'Presidente',
  ADMIN: 'Organizador',
  REFEREE: 'Fiscal',
  STAFF: 'Staff',
};

export type CircuitPermission =
  /** Datos del circuito, categorías, sedes, etapas, puntos y publicación. */
  | 'circuit.edit'
  /** Cuadros, grilla multi-sede y horarios de partidos. */
  | 'circuit.schedule'
  /** Gestionar los torneos del circuito (resultados, inscripciones). */
  | 'circuit.results'
  /** Invitar, editar y quitar miembros del staff. */
  | 'circuit.staff.manage'
  /** Transferir la presidencia. */
  | 'circuit.transfer'
  /** Ver información interna (grilla en borrador, invitaciones pendientes). */
  | 'circuit.view_internal';

const PERMISSIONS_BY_ROLE: Record<CircuitStaffRole, CircuitPermission[]> = {
  PRESIDENT: [
    'circuit.edit',
    'circuit.schedule',
    'circuit.results',
    'circuit.staff.manage',
    'circuit.transfer',
    'circuit.view_internal',
  ],
  ADMIN: [
    'circuit.edit',
    'circuit.schedule',
    'circuit.results',
    'circuit.staff.manage',
    'circuit.view_internal',
  ],
  REFEREE: ['circuit.schedule', 'circuit.results', 'circuit.view_internal'],
  STAFF: ['circuit.view_internal'],
};

/** Roles que cada rol puede asignar/gestionar. La presidencia solo se transfiere. */
const MANAGEABLE_ROLES: Record<CircuitStaffRole, CircuitStaffRole[]> = {
  PRESIDENT: ['ADMIN', 'REFEREE', 'STAFF'],
  ADMIN: ['REFEREE', 'STAFF'],
  REFEREE: [],
  STAFF: [],
};

const ROLE_RANK: Record<CircuitStaffRole, number> = {
  PRESIDENT: 0,
  ADMIN: 1,
  REFEREE: 2,
  STAFF: 3,
};

export type CircuitAccess = {
  circuitId: string;
  role: CircuitStaffRole | null;
  memberId: string | null;
  isSuperAdmin: boolean;
  permissions: CircuitPermission[];
};

export function circuitRoleRank(role: string): number {
  return ROLE_RANK[role as CircuitStaffRole] ?? 99;
}

export function circuitDisplayTitle(
  role: string,
  title: string | null | undefined,
  circuit: { short_name?: string | null; name?: string | null },
): string {
  const custom = title?.trim();
  if (custom) return custom;
  const label = CIRCUIT_ROLE_LABELS[role as CircuitStaffRole] ?? 'Staff';
  const brand = circuit.short_name?.trim() || circuit.name?.trim() || 'circuito';
  return `${label} ${brand}`;
}

@Injectable()
export class CircuitAccessService {
  constructor(private readonly db: DatabaseService) {}

  async getAccess(circuitId: string, userId?: string | null): Promise<CircuitAccess> {
    const circuit = await this.db.query(`SELECT id FROM circuits WHERE id = $1`, [circuitId]);
    if (!circuit.rows[0]) throw new NotFoundException('Circuito no encontrado');

    const empty: CircuitAccess = {
      circuitId,
      role: null,
      memberId: null,
      isSuperAdmin: false,
      permissions: [],
    };
    if (!userId) return empty;

    const res = await this.db.query(
      `SELECT u.role AS user_role, cs.id AS member_id, cs.role AS staff_role
       FROM users u
       LEFT JOIN circuit_staff cs
         ON cs.user_id = u.id AND cs.circuit_id = $1 AND cs.status = 'ACTIVE'
       WHERE u.id = $2`,
      [circuitId, userId],
    );
    const row = res.rows[0];
    if (!row) return empty;

    const isSuperAdmin = row.user_role === 'SUPER_ADMIN';
    const role = (row.staff_role as CircuitStaffRole | null) ?? null;
    const permissions = isSuperAdmin
      ? PERMISSIONS_BY_ROLE.PRESIDENT
      : role
        ? PERMISSIONS_BY_ROLE[role]
        : [];

    return {
      circuitId,
      role,
      memberId: row.member_id ?? null,
      isSuperAdmin,
      permissions: [...permissions],
    };
  }

  async can(circuitId: string, userId: string | null | undefined, permission: CircuitPermission) {
    const access = await this.getAccess(circuitId, userId);
    return access.permissions.includes(permission);
  }

  async assert(
    circuitId: string,
    userId: string | null | undefined,
    permission: CircuitPermission,
    message = 'No tenés permiso en este circuito para realizar esta acción',
  ): Promise<CircuitAccess> {
    const access = await this.getAccess(circuitId, userId);
    if (!access.permissions.includes(permission)) {
      throw new ForbiddenException(message);
    }
    return access;
  }

  /** Rol efectivo para gestionar staff: SUPER_ADMIN actúa como Presidente. */
  effectiveRole(access: CircuitAccess): CircuitStaffRole | null {
    return access.isSuperAdmin ? 'PRESIDENT' : access.role;
  }

  canManageRole(actorRole: CircuitStaffRole | null, targetRole: string): boolean {
    if (!actorRole) return false;
    return MANAGEABLE_ROLES[actorRole].includes(targetRole as CircuitStaffRole);
  }
}
