import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CircuitAccessService } from '../circuit-access.service';

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export type AuditEntry = {
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

@Injectable()
export class CircuitAuditService {
  private readonly logger = new Logger(CircuitAuditService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly access: CircuitAccessService,
  ) {}

  /** Nunca rompe la acción auditada: si falla el registro solo queda en el log del server. */
  async log(
    circuitId: string | null | undefined,
    actorUserId: string | null | undefined,
    entry: AuditEntry,
    q: Queryable = this.db,
  ) {
    if (!circuitId) return;
    try {
      await q.query(
        `INSERT INTO circuit_audit_log
          (circuit_id, actor_user_id, action, entity_type, entity_id, summary, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          circuitId,
          actorUserId ?? null,
          entry.action,
          entry.entityType ?? null,
          entry.entityId ?? null,
          entry.summary,
          entry.meta ? JSON.stringify(entry.meta) : null,
        ],
      );
    } catch (error) {
      this.logger.warn(`No se pudo auditar ${entry.action}: ${(error as Error).message}`);
    }
  }

  /** Atajo para acciones sobre torneos: audita solo si el torneo pertenece a un circuito. */
  async logForTournament(tournamentId: string, actorUserId: string | null, entry: AuditEntry) {
    const result = await this.db.query(`SELECT circuit_id, name FROM tournaments WHERE id = $1`, [
      tournamentId,
    ]);
    const row = result.rows[0];
    if (!row?.circuit_id) return;
    await this.log(row.circuit_id, actorUserId, {
      entityType: 'tournament',
      entityId: tournamentId,
      ...entry,
      summary: `${row.name}: ${entry.summary}`,
    });
  }

  async list(
    circuitId: string,
    userId: string,
    options: { limit?: number; before?: string; action?: string } = {},
  ) {
    await this.access.assert(circuitId, userId, 'circuit.view_internal');
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const params: unknown[] = [circuitId];
    const filters: string[] = [];
    if (options.before) {
      params.push(options.before);
      filters.push(`AND a.created_at < $${params.length}`);
    }
    if (options.action) {
      params.push(`${options.action}%`);
      filters.push(`AND a.action LIKE $${params.length}`);
    }
    params.push(limit);
    const result = await this.db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.summary, a.meta, a.created_at,
              a.actor_user_id, u.name AS actor_name, p.photo_url AS actor_photo_url
       FROM circuit_audit_log a
       LEFT JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN players p ON p.user_id = a.actor_user_id
       WHERE a.circuit_id = $1 ${filters.join(' ')}
       ORDER BY a.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  }
}
