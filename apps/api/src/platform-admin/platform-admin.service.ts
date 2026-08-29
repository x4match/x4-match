import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { ClubTrialService } from '../clubs/club-trial.service';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clubTrialService: ClubTrialService,
  ) {}

  async getMonitor() {
    const [
      users,
      clubs,
      matches,
      tournaments,
      trials,
      trialsExpiring,
      mpConnected,
      recentClubs,
      recentUsers,
      billingBreakdown,
    ] = await Promise.all([
      this.db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`),
      this.db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM clubs`),
      this.db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM matches`),
      this.db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tournaments`),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM club_billing WHERE status = 'TRIAL'`,
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM club_billing
         WHERE status = 'TRIAL' AND trial_ends_at IS NOT NULL
           AND trial_ends_at <= NOW() + INTERVAL '7 days'`,
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM club_payment_config WHERE status = 'CONNECTED'`,
      ),
      this.db.query(
        `SELECT c.id, c.name, c.city, c.created_at, cb.status AS billing_status
         FROM clubs c
         LEFT JOIN club_billing cb ON cb.club_id = c.id
         ORDER BY c.created_at DESC LIMIT 8`,
      ),
      this.db.query(
        `SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 8`,
      ),
      this.db.query(
        `SELECT status, COUNT(*)::int AS count FROM club_billing GROUP BY status`,
      ),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        users: Number(users.rows[0]?.count ?? 0),
        clubs: Number(clubs.rows[0]?.count ?? 0),
        matches: Number(matches.rows[0]?.count ?? 0),
        tournaments: Number(tournaments.rows[0]?.count ?? 0),
        activeTrials: Number(trials.rows[0]?.count ?? 0),
        trialsExpiring7d: Number(trialsExpiring.rows[0]?.count ?? 0),
        mpConnectedClubs: Number(mpConnected.rows[0]?.count ?? 0),
      },
      billingBreakdown: billingBreakdown.rows,
      recentClubs: recentClubs.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        createdAt: row.created_at,
        billingStatus: row.billing_status ?? 'NOT_STARTED',
      })),
      recentUsers: recentUsers.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
      })),
    };
  }

  async listClubs(params: {
    q?: string;
    status?: string;
    mpStatus?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;
    const values: unknown[] = [];
    const filters: string[] = [];

    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      filters.push(`(c.name ILIKE $${values.length} OR c.city ILIKE $${values.length})`);
    }
    if (params.status?.trim()) {
      values.push(params.status.trim());
      filters.push(`COALESCE(cb.status::text, 'NOT_STARTED') = $${values.length}`);
    }
    if (params.mpStatus?.trim()) {
      values.push(params.mpStatus.trim());
      filters.push(`COALESCE(cpc.status::text, 'DISCONNECTED') = $${values.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    values.push(limit, offset);

    const result = await this.db.query(
      `SELECT c.id, c.name, c.city, c.zone, c.subscription_plan, c.created_at,
              cb.status AS billing_status, cb.trial_mode, cb.trial_ends_at,
              cpc.status AS mp_status
       FROM clubs c
       LEFT JOIN club_billing cb ON cb.club_id = c.id
       LEFT JOIN club_payment_config cpc ON cpc.club_id = c.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM clubs c
       LEFT JOIN club_billing cb ON cb.club_id = c.id
       LEFT JOIN club_payment_config cpc ON cpc.club_id = c.id
       ${where}`,
      values.slice(0, values.length - 2),
    );

    return {
      items: result.rows,
      total: Number(countRes.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async getClubDetail(clubId: string) {
    const clubRes = await this.db.query(
      `SELECT c.*, cb.*, cpc.status AS mp_status, cpc.mp_user_id, cpc.connected_at AS mp_connected_at
       FROM clubs c
       LEFT JOIN club_billing cb ON cb.club_id = c.id
       LEFT JOIN club_payment_config cpc ON cpc.club_id = c.id
       WHERE c.id = $1`,
      [clubId],
    );
    const club = clubRes.rows[0];
    if (!club) return null;

    const trial = await this.clubTrialService.getTrialStatus(clubId);
    const admins = await this.db.query(
      `SELECT u.id, u.name, u.email FROM club_admins ca
       JOIN users u ON u.id = ca.user_id WHERE ca.club_id = $1`,
      [clubId],
    );

    return { club, trial, admins: admins.rows };
  }

  async listUsers(params: { q?: string; role?: string; limit?: number; offset?: number }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;
    const values: unknown[] = [];
    const filters: string[] = [];

    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      filters.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
    }
    if (params.role?.trim()) {
      values.push(params.role.trim());
      filters.push(`u.role = $${values.length}::user_role`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    values.push(limit, offset);

    const result = await this.db.query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at
       FROM users u ${where}
       ORDER BY u.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users u ${where}`,
      values.slice(0, values.length - 2),
    );

    return {
      items: result.rows,
      total: Number(countRes.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async listMatches(params: {
    q?: string;
    status?: string;
    clubId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;
    const values: unknown[] = [];
    const filters: string[] = [];

    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      filters.push(`(m.title ILIKE $${values.length} OR c.name ILIKE $${values.length})`);
    }
    if (params.status?.trim()) {
      values.push(params.status.trim());
      filters.push(`m.status::text = $${values.length}`);
    }
    if (params.clubId?.trim()) {
      values.push(params.clubId.trim());
      filters.push(`m.club_id = $${values.length}::uuid`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    values.push(limit, offset);

    const result = await this.db.query(
      `SELECT m.id, m.title, m.status, m.created_at, c.name AS club_name
       FROM matches m
       LEFT JOIN clubs c ON c.id = m.club_id
       ${where}
       ORDER BY m.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM matches m
       LEFT JOIN clubs c ON c.id = m.club_id
       ${where}`,
      values.slice(0, values.length - 2),
    );

    return {
      items: result.rows,
      total: Number(countRes.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async listTournaments(params: {
    q?: string;
    status?: string;
    clubId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;
    const values: unknown[] = [];
    const filters: string[] = [];

    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      filters.push(`(t.name ILIKE $${values.length} OR c.name ILIKE $${values.length})`);
    }
    if (params.status?.trim()) {
      values.push(params.status.trim());
      filters.push(`t.status::text = $${values.length}`);
    }
    if (params.clubId?.trim()) {
      values.push(params.clubId.trim());
      filters.push(`t.club_id = $${values.length}::uuid`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    values.push(limit, offset);

    const result = await this.db.query(
      `SELECT t.id, t.name, t.status, t.created_at, c.name AS club_name
       FROM tournaments t
       LEFT JOIN clubs c ON c.id = t.club_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM tournaments t
       LEFT JOIN clubs c ON c.id = t.club_id
       ${where}`,
      values.slice(0, values.length - 2),
    );

    return {
      items: result.rows,
      total: Number(countRes.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async listPayments(params: {
    q?: string;
    status?: string;
    provider?: string;
    clubId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;
    const values: unknown[] = [];
    const filters: string[] = [];

    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      filters.push(
        `(m.title ILIKE $${values.length} OR c.name ILIKE $${values.length} OR md.provider_payment_id ILIKE $${values.length})`,
      );
    }
    if (params.status?.trim()) {
      values.push(params.status.trim());
      filters.push(`md.status::text = $${values.length}`);
    }
    if (params.provider?.trim()) {
      values.push(`%${params.provider.trim()}%`);
      filters.push(`md.provider ILIKE $${values.length}`);
    }
    if (params.clubId?.trim()) {
      values.push(params.clubId.trim());
      filters.push(`m.club_id = $${values.length}::uuid`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    values.push(limit, offset);

    const result = await this.db.query(
      `SELECT md.id, md.amount, md.status, md.provider, md.created_at,
              m.title AS match_title, c.name AS club_name
       FROM match_deposits md
       JOIN matches m ON m.id = md.match_id
       LEFT JOIN clubs c ON c.id = m.club_id
       ${where}
       ORDER BY md.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM match_deposits md
       JOIN matches m ON m.id = md.match_id
       LEFT JOIN clubs c ON c.id = m.club_id
       ${where}`,
      values.slice(0, values.length - 2),
    );

    return {
      items: result.rows,
      total: Number(countRes.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async listTrials(params: {
    q?: string;
    status?: string;
    mode?: string;
    expiringDays?: number;
    limit?: number;
    offset?: number;
  } = {}) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;
    const values: unknown[] = [];
    const filters = [`cb.status IN ('NOT_STARTED', 'TRIAL', 'GRACE')`];

    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      filters.push(`(c.name ILIKE $${values.length} OR c.city ILIKE $${values.length})`);
    }
    if (params.status?.trim()) {
      values.push(params.status.trim());
      filters.push(`cb.status::text = $${values.length}`);
    }
    if (params.mode?.trim()) {
      values.push(params.mode.trim());
      filters.push(`cb.trial_mode::text = $${values.length}`);
    }
    if (params.expiringDays != null && params.expiringDays > 0) {
      values.push(params.expiringDays);
      filters.push(
        `cb.status = 'TRIAL' AND cb.trial_ends_at IS NOT NULL AND cb.trial_ends_at <= NOW() + ($${values.length} || ' days')::interval`,
      );
    }

    const where = `WHERE ${filters.join(' AND ')}`;
    const countValues = [...values];
    values.push(limit, offset);

    const result = await this.db.query(
      `SELECT c.id, c.name, c.city, cb.status, cb.trial_mode, cb.trial_started_at,
              cb.trial_ends_at, cb.trial_days, cb.checklist
       FROM club_billing cb
       JOIN clubs c ON c.id = cb.club_id
       ${where}
       ORDER BY cb.trial_ends_at NULLS LAST, c.name ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM club_billing cb
       JOIN clubs c ON c.id = cb.club_id
       ${where}`,
      countValues,
    );

    const items = await Promise.all(
      result.rows.map(async (row: any) => {
        const trial = await this.clubTrialService.getTrialStatus(row.id);
        return {
          clubId: row.id,
          clubName: row.name,
          city: row.city,
          ...trial,
        };
      }),
    );

    return {
      items,
      total: Number(countRes.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createOpsUser(params: { email: string; password: string; name: string }) {
    const email = params.email.trim().toLowerCase();
    const existing = await this.db.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows[0]) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);
    const result = await this.db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'SUPER_ADMIN'::user_role)
       RETURNING id, email, name, role, created_at`,
      [email, passwordHash, params.name.trim()],
    );
    return result.rows[0];
  }

  async updateUserRole(userId: string, role: string, actorId: string) {
    const userRes = await this.db.query<{ id: string; role: string; email: string }>(
      `SELECT id, role, email FROM users WHERE id = $1`,
      [userId],
    );
    const user = userRes.rows[0];
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const countRes = await this.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE role = 'SUPER_ADMIN'`,
      );
      if (Number(countRes.rows[0]?.count ?? 0) <= 1) {
        throw new BadRequestException('No podés quitar el único SUPER_ADMIN del sistema');
      }
      if (userId === actorId) {
        throw new BadRequestException('No podés quitarte el rol SUPER_ADMIN a vos mismo');
      }
    }

    const updated = await this.db.query(
      `UPDATE users SET role = $2::user_role, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, role, created_at`,
      [userId, role],
    );
    return updated.rows[0];
  }

  async listOpsUsers() {
    const result = await this.db.query(
      `SELECT id, name, email, role, created_at
       FROM users WHERE role = 'SUPER_ADMIN'
       ORDER BY created_at ASC`,
    );
    return result.rows;
  }
}
