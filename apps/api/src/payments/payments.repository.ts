import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type DepositRow = {
  id: string;
  match_id: string;
  player_id: string;
  user_id: string;
  amount: string | number;
  currency: string;
  provider: string;
  external_reference: string | null;
  provider_preference_id: string | null;
  provider_payment_id: string | null;
  status: string;
  checkout_url: string | null;
  paid_at: Date | null;
  covered_guest_slots: number;
};

@Injectable()
export class PaymentsRepository {
  constructor(private readonly db: DatabaseService) {}

  async getClubPricing(clubId: string) {
    const res = await this.db.query(
      `SELECT id, name, court_price_per_hour, deposit_percent, court_duration_hours
       FROM clubs WHERE id = $1`,
      [clubId],
    );
    return res.rows[0] ?? null;
  }

  async getDepositByMatchPlayer(matchId: string, playerId: string) {
    const res = await this.db.query(
      `SELECT * FROM match_deposits WHERE match_id = $1 AND player_id = $2`,
      [matchId, playerId],
    );
    return (res.rows[0] as DepositRow) ?? null;
  }

  async getDepositById(id: string) {
    const res = await this.db.query(`SELECT * FROM match_deposits WHERE id = $1`, [id]);
    return (res.rows[0] as DepositRow) ?? null;
  }

  async getDepositByExternalRef(ref: string) {
    if (ref.includes(':')) {
      const [matchId, playerId] = ref.split(':');
      return this.getDepositByMatchPlayer(matchId, playerId);
    }
    return this.getDepositById(ref);
  }

  async getCourtSlotDurationHours(slotId: string): Promise<number | null> {
    const res = await this.db.query(
      `SELECT start_hour, end_hour FROM court_availability_slots WHERE id = $1`,
      [slotId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return Math.max(1, Number(row.end_hour) - Number(row.start_hour));
  }

  async listDepositsForMatch(matchId: string) {
    const res = await this.db.query(
      `SELECT md.*, u.name AS user_name
       FROM match_deposits md
       INNER JOIN users u ON u.id = md.user_id
       WHERE md.match_id = $1
       ORDER BY md.created_at ASC`,
      [matchId],
    );
    return res.rows;
  }

  async upsertPendingDeposit(input: {
    matchId: string;
    playerId: string;
    userId: string;
    amount: number;
    currency: string;
    provider: string;
    externalReference: string;
    checkoutUrl?: string | null;
    providerPreferenceId?: string | null;
    coveredGuestSlots?: number;
  }) {
    const res = await this.db.query(
      `INSERT INTO match_deposits (
         match_id, player_id, user_id, amount, currency, provider,
         external_reference, checkout_url, provider_preference_id, status, covered_guest_slots
       ) VALUES ($1, $2, $3, $4, $5, $6::payment_provider, $7, $8, $9, 'PENDING', $10)
       ON CONFLICT (match_id, player_id)
       DO UPDATE SET
         amount = EXCLUDED.amount,
         currency = EXCLUDED.currency,
         provider = EXCLUDED.provider,
         external_reference = EXCLUDED.external_reference,
         checkout_url = COALESCE(EXCLUDED.checkout_url, match_deposits.checkout_url),
         provider_preference_id = COALESCE(EXCLUDED.provider_preference_id, match_deposits.provider_preference_id),
         covered_guest_slots = EXCLUDED.covered_guest_slots,
         status = CASE
           WHEN match_deposits.status = 'APPROVED' THEN match_deposits.status
           ELSE 'PENDING'
         END,
         updated_at = NOW()
       RETURNING *`,
      [
        input.matchId,
        input.playerId,
        input.userId,
        input.amount,
        input.currency,
        input.provider,
        input.externalReference,
        input.checkoutUrl ?? null,
        input.providerPreferenceId ?? null,
        input.coveredGuestSlots ?? 0,
      ],
    );
    return res.rows[0] as DepositRow;
  }

  async markApproved(depositId: string, providerPaymentId?: string) {
    const res = await this.db.query(
      `UPDATE match_deposits
       SET status = 'APPROVED',
           paid_at = NOW(),
           provider_payment_id = COALESCE($2, provider_payment_id),
           updated_at = NOW()
       WHERE id = $1 AND status <> 'APPROVED'
       RETURNING *`,
      [depositId, providerPaymentId ?? null],
    );
    return (res.rows[0] as DepositRow) ?? null;
  }

  async markRefunded(depositId: string) {
    const res = await this.db.query(
      `UPDATE match_deposits
       SET status = 'REFUNDED',
           updated_at = NOW()
       WHERE id = $1 AND status = 'APPROVED'
       RETURNING *`,
      [depositId],
    );
    return (res.rows[0] as DepositRow) ?? null;
  }

  async markCancelled(depositId: string) {
    const res = await this.db.query(
      `UPDATE match_deposits
       SET status = 'CANCELLED',
           updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [depositId],
    );
    return (res.rows[0] as DepositRow) ?? null;
  }

  async updateCheckoutUrl(depositId: string, checkoutUrl: string, preferenceId?: string) {
    await this.db.query(
      `UPDATE match_deposits
       SET checkout_url = $2,
           provider_preference_id = COALESCE($3, provider_preference_id),
           updated_at = NOW()
       WHERE id = $1`,
      [depositId, checkoutUrl, preferenceId ?? null],
    );
  }
}
