import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CircuitAuditService } from './organizer/circuit-audit.service';
import {
  CIRCUIT_ROLE_LABELS,
  CircuitAccessService,
  CircuitStaffRole,
  circuitDisplayTitle,
  circuitRoleRank,
} from './circuit-access.service';
import {
  InviteCircuitStaffDto,
  TransferCircuitPresidencyDto,
  UpdateCircuitStaffDto,
} from './dto/circuit-staff.dto';

const MEMBER_SELECT = `
  SELECT cs.id, cs.circuit_id, cs.user_id, cs.role, cs.title, cs.status,
         cs.invited_by_user_id, cs.responded_at, cs.created_at, cs.updated_at,
         u.name AS user_name, p.id AS player_id, p.nickname, p.photo_url,
         c.name AS circuit_name, c.short_name AS circuit_short_name
  FROM circuit_staff cs
  INNER JOIN users u ON u.id = cs.user_id
  INNER JOIN circuits c ON c.id = cs.circuit_id
  LEFT JOIN players p ON p.user_id = cs.user_id`;

@Injectable()
export class CircuitStaffService {
  private readonly logger = new Logger(CircuitStaffService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly access: CircuitAccessService,
    private readonly notifications: NotificationsService,
    private readonly audit: CircuitAuditService,
  ) {}

  /** Staff activo (público). Quien gestiona el staff ve también las invitaciones pendientes. */
  async listStaff(circuitId: string, viewerId?: string | null) {
    const access = await this.access.getAccess(circuitId, viewerId);
    const includePending = access.permissions.includes('circuit.staff.manage');
    const res = await this.db.query(
      `${MEMBER_SELECT}
       WHERE cs.circuit_id = $1
         AND cs.status = ANY($2::text[])`,
      [circuitId, includePending ? ['ACTIVE', 'PENDING'] : ['ACTIVE']],
    );
    return res.rows
      .map((row) => this.toMember(row))
      .sort(
        (a, b) =>
          (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) ||
          circuitRoleRank(a.role) - circuitRoleRank(b.role) ||
          String(a.userName).localeCompare(String(b.userName)),
      );
  }

  async invite(circuitId: string, actorId: string, dto: InviteCircuitStaffDto) {
    const access = await this.access.assert(
      circuitId,
      actorId,
      'circuit.staff.manage',
      'Solo el Presidente o un Organizador del circuito pueden invitar staff',
    );
    const actorRole = this.access.effectiveRole(access);
    if (!this.access.canManageRole(actorRole, dto.role)) {
      throw new ForbiddenException(
        `No podés asignar el rol ${CIRCUIT_ROLE_LABELS[dto.role]}`,
      );
    }
    if (dto.userId === actorId) {
      throw new BadRequestException('No podés invitarte a vos mismo');
    }

    const target = await this.db.query(`SELECT id, name FROM users WHERE id = $1`, [dto.userId]);
    if (!target.rows[0]) throw new NotFoundException('Usuario no encontrado');

    const existing = await this.db.query(
      `SELECT id, status FROM circuit_staff WHERE circuit_id = $1 AND user_id = $2`,
      [circuitId, dto.userId],
    );
    if (existing.rows[0]?.status === 'ACTIVE') {
      throw new ConflictException('Ese usuario ya forma parte del staff del circuito');
    }

    const title = dto.title?.trim() || null;
    const saved = await this.db.query(
      `INSERT INTO circuit_staff (circuit_id, user_id, role, title, status, invited_by_user_id)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)
       ON CONFLICT (circuit_id, user_id) DO UPDATE
         SET role = EXCLUDED.role,
             title = EXCLUDED.title,
             status = 'PENDING',
             invited_by_user_id = EXCLUDED.invited_by_user_id,
             responded_at = NULL,
             updated_at = NOW()
       RETURNING id`,
      [circuitId, dto.userId, dto.role, title, actorId],
    );
    const member = await this.getMemberOrThrow(saved.rows[0].id);

    const actor = await this.db.query(`SELECT name FROM users WHERE id = $1`, [actorId]);
    const brand = member.circuitShortName || member.circuitName;
    await this.notifySafe({
      userId: dto.userId,
      type: 'CIRCUIT_STAFF_INVITE',
      title: `Te invitaron al staff de ${brand}`,
      body: `${actor.rows[0]?.name ?? 'El organizador'} te invitó como ${member.displayTitle}.`,
      data: { circuitId, memberId: member.id },
    });
    await this.audit.log(circuitId, actorId, {
      action: 'staff.invite',
      entityType: 'circuit_staff',
      entityId: member.id,
      summary: `Invitó a ${member.userName} como ${member.displayTitle}`,
    });

    return member;
  }

  async myInvitations(userId: string) {
    const res = await this.db.query(
      `SELECT cs.id, cs.circuit_id, cs.role, cs.title, cs.created_at,
              c.name AS circuit_name, c.short_name AS circuit_short_name, c.logo_url AS circuit_logo_url,
              inv.name AS invited_by_name
       FROM circuit_staff cs
       INNER JOIN circuits c ON c.id = cs.circuit_id
       LEFT JOIN users inv ON inv.id = cs.invited_by_user_id
       WHERE cs.user_id = $1 AND cs.status = 'PENDING' AND c.status <> 'CANCELLED'
       ORDER BY cs.created_at DESC`,
      [userId],
    );
    return res.rows.map((row) => ({
      id: row.id,
      circuitId: row.circuit_id,
      circuitName: row.circuit_name,
      circuitShortName: row.circuit_short_name,
      circuitLogoUrl: row.circuit_logo_url,
      role: row.role,
      title: row.title,
      displayTitle: circuitDisplayTitle(row.role, row.title, {
        short_name: row.circuit_short_name,
        name: row.circuit_name,
      }),
      invitedByName: row.invited_by_name,
      createdAt: row.created_at,
    }));
  }

  async respond(memberId: string, userId: string, accept: boolean) {
    const res = await this.db.query(
      `SELECT id, user_id, status, invited_by_user_id, circuit_id FROM circuit_staff WHERE id = $1`,
      [memberId],
    );
    const row = res.rows[0];
    if (!row || row.user_id !== userId) throw new NotFoundException('Invitación no encontrada');
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Esta invitación ya no está pendiente');
    }

    await this.db.query(
      `UPDATE circuit_staff
       SET status = $2, responded_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [memberId, accept ? 'ACTIVE' : 'DECLINED'],
    );
    const member = await this.getMemberOrThrow(memberId);

    if (row.invited_by_user_id && row.invited_by_user_id !== userId) {
      await this.notifySafe({
        userId: row.invited_by_user_id,
        type: accept ? 'CIRCUIT_STAFF_ACCEPTED' : 'CIRCUIT_STAFF_DECLINED',
        title: accept ? 'Invitación aceptada' : 'Invitación rechazada',
        body: `${member.userName} ${accept ? 'ya es' : 'no aceptó ser'} ${member.displayTitle}.`,
        data: { circuitId: row.circuit_id, memberId },
      });
    }
    return member;
  }

  async updateMember(
    circuitId: string,
    actorId: string,
    memberId: string,
    dto: UpdateCircuitStaffDto,
  ) {
    const member = await this.getMemberOrThrow(memberId);
    if (member.circuitId !== circuitId) throw new NotFoundException('Miembro no encontrado');

    const access = await this.access.getAccess(circuitId, actorId);
    const actorRole = this.access.effectiveRole(access);
    const isSelf = member.userId === actorId;
    const canManageMember =
      access.permissions.includes('circuit.staff.manage') &&
      this.access.canManageRole(actorRole, member.role);
    const onlyTitle = dto.role === undefined;

    if (!canManageMember && !(isSelf && onlyTitle && member.status === 'ACTIVE')) {
      throw new ForbiddenException('No podés editar a este miembro del staff');
    }
    if (dto.role !== undefined) {
      if (member.role === 'PRESIDENT') {
        throw new BadRequestException('Para cambiar al Presidente usá "Transferir presidencia"');
      }
      if (!this.access.canManageRole(actorRole, dto.role)) {
        throw new ForbiddenException(`No podés asignar el rol ${CIRCUIT_ROLE_LABELS[dto.role]}`);
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [memberId];
    if (dto.role !== undefined) {
      params.push(dto.role);
      sets.push(`role = $${params.length}`);
    }
    if (dto.title !== undefined) {
      params.push(dto.title.trim() || null);
      sets.push(`title = $${params.length}`);
    }
    if (!sets.length) return member;

    await this.db.query(
      `UPDATE circuit_staff SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
      params,
    );
    const updated = await this.getMemberOrThrow(memberId);
    await this.audit.log(circuitId, actorId, {
      action: 'staff.update',
      entityType: 'circuit_staff',
      entityId: memberId,
      summary: `${updated.userName}: ahora es ${updated.displayTitle}`,
    });
    return updated;
  }

  /** Quitar a un miembro, cancelar una invitación o (si es uno mismo) salir del staff. */
  async removeMember(circuitId: string, actorId: string, memberId: string) {
    const member = await this.getMemberOrThrow(memberId);
    if (member.circuitId !== circuitId) throw new NotFoundException('Miembro no encontrado');
    if (member.status !== 'ACTIVE' && member.status !== 'PENDING') {
      return { ok: true };
    }

    const isSelf = member.userId === actorId;
    if (member.role === 'PRESIDENT' && member.status === 'ACTIVE') {
      throw new BadRequestException(
        isSelf
          ? 'Transferí la presidencia a otro miembro antes de salir del circuito'
          : 'No se puede quitar al Presidente; primero hay que transferir la presidencia',
      );
    }

    if (!isSelf) {
      const access = await this.access.getAccess(circuitId, actorId);
      const actorRole = this.access.effectiveRole(access);
      if (
        !access.permissions.includes('circuit.staff.manage') ||
        !this.access.canManageRole(actorRole, member.role)
      ) {
        throw new ForbiddenException('No podés quitar a este miembro del staff');
      }
    }

    await this.db.query(
      `UPDATE circuit_staff SET status = $2, updated_at = NOW() WHERE id = $1`,
      [memberId, isSelf ? 'LEFT' : 'REVOKED'],
    );
    await this.audit.log(circuitId, actorId, {
      action: isSelf ? 'staff.leave' : 'staff.remove',
      entityType: 'circuit_staff',
      entityId: memberId,
      summary: isSelf
        ? `${member.userName} dejó el staff`
        : member.status === 'PENDING'
          ? `Canceló la invitación de ${member.userName}`
          : `Quitó a ${member.userName} del staff`,
    });
    return { ok: true };
  }

  async transferPresidency(circuitId: string, actorId: string, dto: TransferCircuitPresidencyDto) {
    await this.access.assert(
      circuitId,
      actorId,
      'circuit.transfer',
      'Solo el Presidente puede transferir la presidencia',
    );
    const target = await this.getMemberOrThrow(dto.memberId);
    if (target.circuitId !== circuitId) throw new NotFoundException('Miembro no encontrado');
    if (target.status !== 'ACTIVE') {
      throw new BadRequestException('Solo podés transferir la presidencia a un miembro activo');
    }
    if (target.role === 'PRESIDENT') return target;

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE circuit_staff
         SET role = 'ADMIN', title = NULL, updated_at = NOW()
         WHERE circuit_id = $1 AND role = 'PRESIDENT' AND status = 'ACTIVE'`,
        [circuitId],
      );
      await client.query(
        `UPDATE circuit_staff SET role = 'PRESIDENT', title = NULL, updated_at = NOW() WHERE id = $1`,
        [target.id],
      );
      await client.query(
        `UPDATE circuits SET created_by_user_id = $2, updated_at = NOW() WHERE id = $1`,
        [circuitId, target.userId],
      );
    });

    const updated = await this.getMemberOrThrow(target.id);
    await this.notifySafe({
      userId: updated.userId,
      type: 'CIRCUIT_PRESIDENCY_TRANSFERRED',
      title: `Sos ${updated.displayTitle}`,
      body: `Te transfirieron la presidencia de ${updated.circuitShortName || updated.circuitName}.`,
      data: { circuitId, memberId: updated.id },
    });
    await this.audit.log(circuitId, actorId, {
      action: 'staff.transfer',
      entityType: 'circuit_staff',
      entityId: updated.id,
      summary: `Transfirió la presidencia a ${updated.userName}`,
    });
    return updated;
  }

  /** Cargos activos de un usuario en circuitos vigentes (carteles del perfil). */
  async rolesForUser(userId: string) {
    const res = await this.db.query(
      `SELECT cs.id, cs.circuit_id, cs.role, cs.title,
              c.name AS circuit_name, c.short_name AS circuit_short_name,
              c.logo_url AS circuit_logo_url, c.status AS circuit_status
       FROM circuit_staff cs
       INNER JOIN circuits c ON c.id = cs.circuit_id
       WHERE cs.user_id = $1 AND cs.status = 'ACTIVE' AND c.status <> 'CANCELLED'`,
      [userId],
    );
    return res.rows
      .map((row) => ({
        memberId: row.id,
        circuitId: row.circuit_id,
        circuitName: row.circuit_name,
        circuitShortName: row.circuit_short_name,
        circuitLogoUrl: row.circuit_logo_url,
        circuitStatus: row.circuit_status,
        role: row.role as CircuitStaffRole,
        title: row.title,
        displayTitle: circuitDisplayTitle(row.role, row.title, {
          short_name: row.circuit_short_name,
          name: row.circuit_name,
        }),
      }))
      .sort((a, b) => circuitRoleRank(a.role) - circuitRoleRank(b.role));
  }

  private async getMemberOrThrow(memberId: string) {
    const res = await this.db.query(`${MEMBER_SELECT} WHERE cs.id = $1`, [memberId]);
    if (!res.rows[0]) throw new NotFoundException('Miembro no encontrado');
    return this.toMember(res.rows[0]);
  }

  private toMember(row: any) {
    return {
      id: row.id as string,
      circuitId: row.circuit_id as string,
      circuitName: row.circuit_name as string,
      circuitShortName: (row.circuit_short_name as string | null) ?? null,
      userId: row.user_id as string,
      userName: (row.user_name as string) ?? 'Jugador',
      playerId: (row.player_id as string | null) ?? null,
      nickname: (row.nickname as string | null) ?? null,
      photoUrl: (row.photo_url as string | null) ?? null,
      role: row.role as CircuitStaffRole,
      title: (row.title as string | null) ?? null,
      displayTitle: circuitDisplayTitle(row.role, row.title, {
        short_name: row.circuit_short_name,
        name: row.circuit_name,
      }),
      status: row.status as string,
      invitedByUserId: (row.invited_by_user_id as string | null) ?? null,
      respondedAt: row.responded_at ?? null,
      createdAt: row.created_at,
    };
  }

  private async notifySafe(params: Parameters<NotificationsService['create']>[0]) {
    try {
      await this.notifications.create(params);
    } catch (error) {
      this.logger.warn(`Notificación de staff no enviada: ${(error as Error).message}`);
    }
  }
}
