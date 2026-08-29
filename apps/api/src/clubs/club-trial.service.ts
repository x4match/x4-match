import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ChecklistItemState,
  ClubBillingStatus,
  ClubTrialMode,
  TRIAL_CHECKLIST_TEMPLATE,
  TrialChecklistKey,
} from './club-trial.constants';

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
  checklist: Record<string, ChecklistItemState>;
  ops_notes: string | null;
};

function defaultChecklist(): Record<string, ChecklistItemState> {
  return Object.fromEntries(
    TRIAL_CHECKLIST_TEMPLATE.map((item) => [item.key, { done: false }]),
  );
}

@Injectable()
export class ClubTrialService {
  constructor(private readonly db: DatabaseService) {}

  async ensureBillingRow(clubId: string): Promise<BillingRow> {
    const existing = await this.getRow(clubId);
    if (existing) return existing;

    await this.db.query(
      `INSERT INTO club_billing (club_id, checklist)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (club_id) DO NOTHING`,
      [clubId, JSON.stringify(defaultChecklist())],
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

  private checklistProgress(checklist: Record<string, ChecklistItemState>) {
    const items = TRIAL_CHECKLIST_TEMPLATE.map((template) => ({
      ...template,
      state: checklist[template.key] ?? { done: false },
    }));
    const required = items.filter((i) => i.required);
    const doneRequired = required.filter((i) => i.state.done).length;
    const doneAll = items.filter((i) => i.state.done).length;
    return {
      items,
      requiredTotal: required.length,
      requiredDone: doneRequired,
      allDone: doneAll,
      allTotal: items.length,
      ready: doneRequired >= required.length,
    };
  }

  async syncAutoChecklist(clubId: string): Promise<Record<string, ChecklistItemState>> {
    const row = await this.ensureBillingRow(clubId);
    const checklist = { ...defaultChecklist(), ...row.checklist };

    const clubRes = await this.db.query<{
      name: string;
      city: string | null;
      phone: string | null;
      logo_url: string | null;
    }>(`SELECT name, city, phone, logo_url FROM clubs WHERE id = $1`, [clubId]);
    const club = clubRes.rows[0];
    if (!club) throw new NotFoundException('Club no encontrado');

    const profileComplete = !!(
      club.name?.trim() &&
      club.city?.trim() &&
      club.phone?.trim() &&
      club.logo_url?.trim()
    );
    if (profileComplete && !checklist.club_profile_complete?.done) {
      checklist.club_profile_complete = {
        done: true,
        at: new Date().toISOString(),
        note: 'auto',
      };
    }

    const mpRes = await this.db.query<{ status: string }>(
      `SELECT status FROM club_payment_config WHERE club_id = $1`,
      [clubId],
    );
    const mpConnected = mpRes.rows[0]?.status === 'CONNECTED';
    if (mpConnected && !checklist.mp_connected?.done) {
      checklist.mp_connected = {
        done: true,
        at: new Date().toISOString(),
        note: 'auto',
      };
    }

    const slotsRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM court_availability_slots WHERE club_id = $1`,
      [clubId],
    );
    const hasSlots = Number(slotsRes.rows[0]?.count ?? 0) > 0;
    if (hasSlots && !checklist.first_slot_published?.done) {
      checklist.first_slot_published = {
        done: true,
        at: new Date().toISOString(),
        note: 'auto',
      };
    }

    await this.db.query(
      `UPDATE club_billing SET checklist = $2::jsonb, updated_at = NOW() WHERE club_id = $1`,
      [clubId, JSON.stringify(checklist)],
    );

    return checklist;
  }

  async getTrialStatus(clubId: string) {
    await this.syncAutoChecklist(clubId);
    const row = await this.ensureBillingRow(clubId);
    const progress = this.checklistProgress(row.checklist);
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
      checklist: progress,
      canStartTrial: row.status === 'NOT_STARTED' && progress.ready,
      isTrialActive: row.status === 'TRIAL',
      isAccessAllowed: ['TRIAL', 'ACTIVE', 'GRACE'].includes(row.status),
    };
  }

  async updateChecklistItem(
    clubId: string,
    key: TrialChecklistKey,
    done: boolean,
    userId: string,
    note?: string,
  ) {
    if (!TRIAL_CHECKLIST_TEMPLATE.some((i) => i.key === key)) {
      throw new BadRequestException('Ítem de checklist inválido');
    }
    const row = await this.ensureBillingRow(clubId);
    const checklist = { ...defaultChecklist(), ...row.checklist };
    checklist[key] = {
      done,
      at: done ? new Date().toISOString() : null,
      by: done ? userId : null,
      note: note ?? null,
    };
    await this.db.query(
      `UPDATE club_billing SET checklist = $2::jsonb, updated_at = NOW() WHERE club_id = $1`,
      [clubId, JSON.stringify(checklist)],
    );
    return this.getTrialStatus(clubId);
  }

  async startTrial(params: {
    clubId: string;
    mode: ClubTrialMode;
    trialDays?: number;
    force?: boolean;
    userId: string;
  }) {
    const { clubId, mode, trialDays = 90, force = false, userId } = params;
    await this.syncAutoChecklist(clubId);
    const row = await this.ensureBillingRow(clubId);

    if (row.status === 'TRIAL' || row.status === 'ACTIVE') {
      throw new BadRequestException('El club ya tiene trial o plan activo');
    }

    const progress = this.checklistProgress(row.checklist);
    if (!force && !progress.ready) {
      throw new BadRequestException(
        'Completá el checklist requerido antes de iniciar el trial',
      );
    }

    const now = new Date();
    const trialEndsAt =
      mode === 'TIME' ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

    const checklist = { ...row.checklist };
    if (!checklist.ops_approved?.done) {
      checklist.ops_approved = {
        done: true,
        at: now.toISOString(),
        by: userId,
        note: force ? 'force-start' : 'trial-start',
      };
    }

    await this.db.query(
      `UPDATE club_billing SET
         status = 'TRIAL',
         trial_mode = $2,
         trial_started_at = $3,
         trial_ends_at = $4,
         trial_days = $5,
         checklist = $6::jsonb,
         suspended_at = NULL,
         updated_at = NOW()
       WHERE club_id = $1`,
      [
        clubId,
        mode,
        now,
        trialEndsAt,
        trialDays,
        JSON.stringify(checklist),
      ],
    );

    return this.getTrialStatus(clubId);
  }

  async activatePaid(clubId: string, userId: string) {
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

    await this.updateChecklistItem(clubId, 'billing_method', true, userId, 'plan-activo');
    return this.getTrialStatus(clubId);
  }

  async deactivatePaid(clubId: string, userId: string) {
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

    await this.updateChecklistItem(clubId, 'billing_method', false, userId, 'plan-desactivado');
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
