import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ClubBillingStatus, ClubTrialMode } from './club-trial.constants';

type BillingRow = {
  club_id: string;
  status: ClubBillingStatus;
  trial_mode: ClubTrialMode | null;
  trial_started_at: Date | string | null;
  trial_ends_at: Date | string | null;
  trial_days: number;
  activated_at: Date | string | null;
  grace_ends_at: Date | string | null;
  suspended_at: Date | string | null;
  checklist: Record<string, unknown>;
  ops_notes: string | null;
};

@Injectable()
export class ClubTrialService {
  constructor(private readonly db: DatabaseService) {}

  async ensureBillingRow(clubId: string): Promise<BillingRow> {
    const existing = await this.getRow(clubId);
    if (existing) return existing;

    await this.db.query(
      `INSERT INTO club_billing (club_id, checklist)
       VALUES ($1, '{}'::jsonb)
       ON CONFLICT (club_id) DO NOTHING`,
      [clubId],
    );
    const row = await this.getRow(clubId);
    if (!row) throw new NotFoundException('No se pudo inicializar billing del club');
    return row;
  }

  async getRow(clubId: string): Promise<BillingRow | null> {
    const result = await this.db.query<BillingRow>(
      `SELECT club_id, status, trial_mode, trial_started_at, trial_ends_at, trial_days,
              activated_at, grace_ends_at, suspended_at, checklist, ops_notes
       FROM club_billing WHERE club_id = $1`,
      [clubId],
    );
    return result.rows[0] ?? null;
  }

  private daysRemaining(endsAt: Date | string | null): number | null {
    if (!endsAt) return null;
    const diff = new Date(endsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  async getTrialStatus(clubId: string) {
    const row = await this.ensureBillingRow(clubId);
    const daysRemaining = this.daysRemaining(row.trial_ends_at);

    return {
      clubId,
      status: row.status,
      trialMode: row.trial_mode,
      trialStartedAt: row.trial_started_at
        ? new Date(row.trial_started_at).toISOString()
        : null,
      trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at).toISOString() : null,
      trialDays: row.trial_days,
      daysRemaining,
      activatedAt: row.activated_at ? new Date(row.activated_at).toISOString() : null,
      graceEndsAt: row.grace_ends_at ? new Date(row.grace_ends_at).toISOString() : null,
      suspendedAt: row.suspended_at ? new Date(row.suspended_at).toISOString() : null,
      opsNotes: row.ops_notes,
      canStartTrial: row.status === 'NOT_STARTED' || row.status === 'GRACE',
      isTrialActive: row.status === 'TRIAL',
      isAccessAllowed: ['TRIAL', 'ACTIVE', 'GRACE'].includes(row.status),
    };
  }

  async startTrial(params: {
    clubId: string;
    mode: ClubTrialMode;
    trialDays?: number;
    force?: boolean;
    userId: string;
  }) {
    const { clubId, mode, trialDays = 90 } = params;
    const row = await this.ensureBillingRow(clubId);

    if (row.status === 'TRIAL' || row.status === 'ACTIVE') {
      throw new BadRequestException('El club ya tiene trial o plan activo');
    }

    const now = new Date();
    const trialEndsAt =
      mode === 'TIME' ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

    await this.db.query(
      `UPDATE club_billing SET
         status = 'TRIAL',
         trial_mode = $2,
         trial_started_at = $3,
         trial_ends_at = $4,
         trial_days = $5,
         suspended_at = NULL,
         updated_at = NOW()
       WHERE club_id = $1`,
      [clubId, mode, now, trialEndsAt, trialDays],
    );

    return this.getTrialStatus(clubId);
  }

  async activatePaid(clubId: string, _userId: string) {
    const row = await this.ensureBillingRow(clubId);
    if (row.status === 'ACTIVE') {
      return this.getTrialStatus(clubId);
    }

    await this.db.query(
      `UPDATE club_billing SET
         status = 'ACTIVE',
         activated_at = NOW(),
         trial_ends_at = NULL,
         grace_ends_at = NULL,
         suspended_at = NULL,
         updated_at = NOW()
       WHERE club_id = $1`,
      [clubId],
    );

    return this.getTrialStatus(clubId);
  }

  async deactivatePaid(clubId: string, _userId: string) {
    const row = await this.ensureBillingRow(clubId);
    const hadPaidPlan = row.status === 'ACTIVE' || !!row.activated_at;
    if (!hadPaidPlan) {
      throw new BadRequestException('El club no tiene un plan de pago activo');
    }

    await this.db.query(
      `UPDATE club_billing SET
         status = 'NOT_STARTED',
         activated_at = NULL,
         suspended_at = NULL,
         grace_ends_at = NULL,
         updated_at = NOW()
       WHERE club_id = $1`,
      [clubId],
    );

    return this.getTrialStatus(clubId);
  }

  async reactivate(clubId: string) {
    const row = await this.ensureBillingRow(clubId);
    if (row.status !== 'SUSPENDED') {
      throw new BadRequestException('El club no está suspendido');
    }

    const nextStatus: ClubBillingStatus = row.activated_at
      ? 'ACTIVE'
      : row.trial_started_at
        ? 'TRIAL'
        : 'NOT_STARTED';

    await this.db.query(
      `UPDATE club_billing SET
         status = $2::club_billing_status,
         suspended_at = NULL,
         updated_at = NOW()
       WHERE club_id = $1`,
      [clubId, nextStatus],
    );

    return this.getTrialStatus(clubId);
  }

  async enterGrace(clubId: string, graceDays = 7) {
    const graceEnds = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
    await this.db.query(
      `UPDATE club_billing SET status = 'GRACE', grace_ends_at = $2, updated_at = NOW()
       WHERE club_id = $1`,
      [clubId, graceEnds],
    );
    return this.getTrialStatus(clubId);
  }

  async suspend(clubId: string, notes?: string) {
    await this.db.query(
      `UPDATE club_billing SET status = 'SUSPENDED', suspended_at = NOW(),
         ops_notes = COALESCE($2, ops_notes), updated_at = NOW()
       WHERE club_id = $1`,
      [clubId, notes ?? null],
    );
    return this.getTrialStatus(clubId);
  }

  async extendTrial(clubId: string, extraDays: number) {
    const row = await this.ensureBillingRow(clubId);
    if (row.status !== 'TRIAL' || row.trial_mode !== 'TIME') {
      throw new BadRequestException('Solo trials por tiempo pueden extenderse');
    }
    const base = row.trial_ends_at ? new Date(row.trial_ends_at) : new Date();
    const next = new Date(base.getTime() + extraDays * 24 * 60 * 60 * 1000);
    await this.db.query(
      `UPDATE club_billing SET trial_ends_at = $2, updated_at = NOW() WHERE club_id = $1`,
      [clubId, next],
    );
    return this.getTrialStatus(clubId);
  }

  async setOpsNotes(clubId: string, notes: string) {
    await this.ensureBillingRow(clubId);
    await this.db.query(
      `UPDATE club_billing SET ops_notes = $2, updated_at = NOW() WHERE club_id = $1`,
      [clubId, notes],
    );
    return this.getTrialStatus(clubId);
  }

  assertClubAccessAllowed(status: ClubBillingStatus): void {
    if (!['TRIAL', 'ACTIVE', 'GRACE'].includes(status)) {
      throw new BadRequestException(
        'El club no tiene acceso activo. Contactá a soporte de x4 match.',
      );
    }
  }
}
