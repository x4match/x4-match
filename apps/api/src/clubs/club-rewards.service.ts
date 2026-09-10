import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { isClubRole } from '../common/roles';
import { DatabaseService } from '../database/database.service';
import { assertRewardRedeemable, generateRedemptionCode } from './club-rewards.util';
import { CreateClubRewardDto } from './dto/create-club-reward.dto';
import { UpdateClubRewardDto } from './dto/update-club-reward.dto';

type RewardRow = {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  points_required: number;
  reward_type: string;
  active: boolean;
  stock: number | null;
  max_per_user: number | null;
  created_at: Date;
};

@Injectable()
export class ClubRewardsService {
  constructor(private readonly db: DatabaseService) {}

  async getPublicCatalog(clubId: string) {
    await this.assertClubExists(clubId);
    const result = await this.db.query(
      `SELECT id, title, description, points_required, reward_type, stock, max_per_user
       FROM club_reward_catalog
       WHERE club_id = $1 AND active = TRUE
         AND (stock IS NULL OR stock > 0)
       ORDER BY points_required ASC`,
      [clubId],
    );
    return result.rows.map((row) => this.mapReward(row));
  }

  async listRewards(clubId: string, userId: string) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `SELECT id, club_id, title, description, points_required, reward_type, active,
              stock, max_per_user, created_at
       FROM club_reward_catalog
       WHERE club_id = $1
       ORDER BY active DESC, points_required ASC`,
      [clubId],
    );
    return result.rows.map((row) => this.mapReward(row));
  }

  async createReward(clubId: string, userId: string, dto: CreateClubRewardDto) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `INSERT INTO club_reward_catalog
         (club_id, title, description, points_required, reward_type, active, stock, max_per_user)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        clubId,
        dto.title,
        dto.description ?? null,
        dto.pointsRequired,
        dto.rewardType ?? 'BENEFIT',
        dto.active ?? true,
        dto.stock ?? null,
        dto.maxPerUser ?? null,
      ],
    );
    return this.mapReward(result.rows[0]);
  }

  async updateReward(clubId: string, userId: string, rewardId: string, dto: UpdateClubRewardDto) {
    await this.assertClubRole(userId, clubId);
    const result = await this.db.query(
      `UPDATE club_reward_catalog
       SET title = COALESCE($3, title),
           description = COALESCE($4, description),
           points_required = COALESCE($5, points_required),
           reward_type = COALESCE($6, reward_type),
           active = COALESCE($7, active),
           stock = CASE WHEN $8::boolean THEN $9 ELSE stock END,
           max_per_user = CASE WHEN $10::boolean THEN $11 ELSE max_per_user END
       WHERE id = $1 AND club_id = $2
       RETURNING *`,
      [
        rewardId,
        clubId,
        dto.title ?? null,
        dto.description ?? null,
        dto.pointsRequired ?? null,
        dto.rewardType ?? null,
        dto.active ?? null,
        dto.stock !== undefined,
        dto.stock ?? null,
        dto.maxPerUser !== undefined,
        dto.maxPerUser ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Premio no encontrado');
    }
    return this.mapReward(result.rows[0]);
  }

  async redeemReward(clubId: string, userId: string, rewardId: string) {
    await this.assertClubExists(clubId);

    return this.db.transaction(async (client) => {
      const rewardResult = await client.query<RewardRow>(
        `SELECT id, club_id, title, description, points_required, reward_type, active,
                stock, max_per_user, created_at
         FROM club_reward_catalog
         WHERE id = $1 AND club_id = $2
         FOR UPDATE`,
        [rewardId, clubId],
      );
      const reward = rewardResult.rows[0];
      if (!reward) {
        throw new NotFoundException('Premio no encontrado');
      }

      const userCountRes = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM club_reward_redemptions
         WHERE club_id = $1 AND user_id = $2 AND reward_id = $3
           AND status IN ('PENDING', 'FULFILLED')`,
        [clubId, userId, rewardId],
      );
      const userRedemptionCount = Number(userCountRes.rows[0]?.count ?? 0);

      const balanceResult = await client.query(
        `SELECT COALESCE(SUM(points), 0)::int AS points
         FROM club_member_points
         WHERE user_id = $1`,
        [userId],
      );
      const balance = Number(balanceResult.rows[0]?.points ?? 0);

      try {
        assertRewardRedeemable({
          active: reward.active,
          stock: reward.stock != null ? Number(reward.stock) : null,
          maxPerUser: reward.max_per_user != null ? Number(reward.max_per_user) : null,
          userRedemptionCount,
          balance,
          pointsRequired: Number(reward.points_required),
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'PREMIO_INACTIVO') throw new NotFoundException('Premio no encontrado');
        if (code === 'SIN_STOCK') throw new BadRequestException('Este premio no tiene stock disponible');
        if (code === 'CUPO_EXCEDIDO') {
          throw new BadRequestException('Ya alcanaste el límite de canjes de este premio');
        }
        if (code === 'SALDO_INSUFICIENTE') {
          throw new BadRequestException(
            `Te faltan ${Number(reward.points_required) - balance} puntos para canjear este premio`,
          );
        }
        throw error;
      }

      const deductions = await this.deductPoints(
        client,
        userId,
        clubId,
        Number(reward.points_required),
        rewardId,
      );

      if (reward.stock != null) {
        const stockUpdate = await client.query(
          `UPDATE club_reward_catalog
           SET stock = stock - 1
           WHERE id = $1 AND club_id = $2 AND stock > 0
           RETURNING stock`,
          [rewardId, clubId],
        );
        if (!stockUpdate.rows[0]) {
          throw new BadRequestException('Este premio no tiene stock disponible');
        }
      }

      let redemptionCode = generateRedemptionCode();
      let redemption: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const insert = await client.query(
            `INSERT INTO club_reward_redemptions
               (club_id, user_id, reward_id, points_spent, status, redemption_code)
             VALUES ($1, $2, $3, $4, 'PENDING', $5)
             RETURNING id, club_id, user_id, reward_id, points_spent, status, redemption_code, created_at`,
            [clubId, userId, rewardId, reward.points_required, redemptionCode],
          );
          redemption = insert.rows[0];
          break;
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code;
          if (code === '23505') {
            redemptionCode = generateRedemptionCode();
            continue;
          }
          throw err;
        }
      }
      if (!redemption) {
        throw new BadRequestException('No se pudo generar el código de canje');
      }

      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'REWARD_REDEEMED', $2, $3, $4::jsonb)`,
        [
          userId,
          'Premio canjeado',
          `Canjeaste "${reward.title}". Código: ${redemptionCode}. Presentate en recepción.`,
          JSON.stringify({
            clubId,
            rewardId,
            redemptionId: redemption.id,
            redemptionCode,
            status: 'PENDING',
          }),
        ],
      );

      return {
        ok: true,
        rewardTitle: reward.title,
        pointsSpent: Number(reward.points_required),
        remainingPoints: balance - Number(reward.points_required),
        status: 'PENDING',
        redemptionCode,
        redemption: this.mapRedemption({
          ...redemption,
          reward_title: reward.title,
          user_name: null,
          user_nickname: null,
        }),
        deductions,
      };
    });
  }

  async listMyRedemptions(clubId: string, userId: string, limit = 50) {
    await this.assertClubExists(clubId);
    const safeLimit = Math.min(100, Math.max(5, limit));
    const result = await this.db.query(
      `SELECT r.id, r.club_id, r.user_id, r.reward_id, r.points_spent, r.status,
              r.redemption_code, r.created_at, r.fulfilled_at, r.cancelled_at,
              rc.title AS reward_title, rc.reward_type
       FROM club_reward_redemptions r
       INNER JOIN club_reward_catalog rc ON rc.id = r.reward_id
       WHERE r.club_id = $1 AND r.user_id = $2
       ORDER BY r.created_at DESC
       LIMIT $3`,
      [clubId, userId, safeLimit],
    );
    return result.rows.map((row) => this.mapRedemption(row));
  }

  async listRedemptions(
    clubId: string,
    userId: string,
    options: { status?: string; limit?: number } = {},
  ) {
    await this.assertClubRole(userId, clubId);
    const safeLimit = Math.min(100, Math.max(5, options.limit ?? 50));
    const status = options.status?.toUpperCase();
    const params: Array<string | number> = [clubId];
    let statusFilter = '';
    if (status === 'PENDING' || status === 'FULFILLED' || status === 'CANCELLED') {
      params.push(status);
      statusFilter = `AND r.status = $${params.length}`;
    }
    params.push(safeLimit);

    const result = await this.db.query(
      `SELECT r.id, r.club_id, r.user_id, r.reward_id, r.points_spent, r.status,
              r.redemption_code, r.created_at, r.fulfilled_at, r.cancelled_at, r.cancel_reason,
              u.name AS user_name,
              p.nickname AS user_nickname,
              rc.title AS reward_title, rc.reward_type
       FROM club_reward_redemptions r
       INNER JOIN users u ON u.id = r.user_id
       LEFT JOIN players p ON p.user_id = r.user_id
       INNER JOIN club_reward_catalog rc ON rc.id = r.reward_id
       WHERE r.club_id = $1 ${statusFilter}
       ORDER BY r.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((row) => this.mapRedemption(row));
  }

  async fulfillRedemption(clubId: string, staffUserId: string, redemptionId: string) {
    await this.assertClubRole(staffUserId, clubId);
    const result = await this.db.query(
      `UPDATE club_reward_redemptions
       SET status = 'FULFILLED',
           fulfilled_at = NOW(),
           fulfilled_by = $3
       WHERE id = $1 AND club_id = $2 AND status = 'PENDING'
       RETURNING id, club_id, user_id, reward_id, points_spent, status, redemption_code,
                 created_at, fulfilled_at, cancelled_at`,
      [redemptionId, clubId, staffUserId],
    );
    if (!result.rows[0]) {
      throw new BadRequestException('Canje no encontrado o ya no está pendiente');
    }
    const titleRes = await this.db.query(`SELECT title FROM club_reward_catalog WHERE id = $1`, [
      result.rows[0].reward_id,
    ]);
    return this.mapRedemption({
      ...result.rows[0],
      reward_title: titleRes.rows[0]?.title ?? null,
      user_name: null,
      user_nickname: null,
    });
  }

  async cancelRedemption(
    clubId: string,
    staffUserId: string,
    redemptionId: string,
    reason?: string,
  ) {
    await this.assertClubRole(staffUserId, clubId);

    return this.db.transaction(async (client) => {
      const existing = await client.query(
        `SELECT id, user_id, reward_id, points_spent, status, redemption_code, created_at
         FROM club_reward_redemptions
         WHERE id = $1 AND club_id = $2
         FOR UPDATE`,
        [redemptionId, clubId],
      );
      const row = existing.rows[0];
      if (!row) throw new NotFoundException('Canje no encontrado');
      if (row.status !== 'PENDING') {
        throw new BadRequestException('Solo se pueden cancelar canjes pendientes');
      }

      await client.query(
        `UPDATE club_reward_redemptions
         SET status = 'CANCELLED',
             cancelled_at = NOW(),
             cancel_reason = $3
         WHERE id = $1`,
        [redemptionId, reason?.trim() || null],
      );

      await client.query(
        `INSERT INTO club_member_points (club_id, user_id, points, matches_at_club, updated_at)
         VALUES ($1, $2, $3, 0, NOW())
         ON CONFLICT (club_id, user_id)
         DO UPDATE SET
           points = club_member_points.points + EXCLUDED.points,
           updated_at = NOW()`,
        [clubId, row.user_id, Number(row.points_spent)],
      );

      await client.query(
        `INSERT INTO club_points_ledger (club_id, user_id, amount, reason, reference_id)
         VALUES ($1, $2, $3, 'REWARD_REFUND', $4)`,
        [clubId, row.user_id, Number(row.points_spent), redemptionId],
      );

      // Restore stock if the reward tracks inventory
      await client.query(
        `UPDATE club_reward_catalog
         SET stock = stock + 1
         WHERE id = $1 AND club_id = $2 AND stock IS NOT NULL`,
        [row.reward_id, clubId],
      );

      const titleRes = await client.query(`SELECT title FROM club_reward_catalog WHERE id = $1`, [
        row.reward_id,
      ]);

      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'REWARD_CANCELLED', $2, $3, $4::jsonb)`,
        [
          row.user_id,
          'Canje cancelado',
          `Se canceló tu canje "${titleRes.rows[0]?.title ?? 'premio'}" y se reintegraron ${row.points_spent} puntos.`,
          JSON.stringify({ clubId, redemptionId, status: 'CANCELLED' }),
        ],
      );

      return this.mapRedemption({
        ...row,
        status: 'CANCELLED',
        cancelled_at: new Date(),
        cancel_reason: reason?.trim() || null,
        reward_title: titleRes.rows[0]?.title ?? null,
        user_name: null,
        user_nickname: null,
      });
    });
  }

  private async deductPoints(
    client: PoolClient,
    userId: string,
    clubId: string,
    pointsRequired: number,
    rewardId: string,
  ) {
    const deductionsResult = await client.query<{ club_id: string; deducted: number }>(
      `WITH balances AS (
         SELECT club_id,
                points,
                SUM(points) OVER (
                  ORDER BY
                    CASE WHEN club_id = $2 THEN 0 ELSE 1 END,
                    points DESC,
                    club_id ASC
                ) AS running_points
         FROM club_member_points
         WHERE user_id = $1 AND points > 0
         FOR UPDATE
       ),
       cuts AS (
         SELECT club_id,
                GREATEST(
                  0,
                  LEAST(points, $3 - (running_points - points))
                )::int AS deducted
         FROM balances
         WHERE (running_points - points) < $3
       ),
       updated AS (
         UPDATE club_member_points cmp
         SET points = cmp.points - cuts.deducted,
             updated_at = NOW()
         FROM cuts
         WHERE cmp.user_id = $1
           AND cmp.club_id = cuts.club_id
           AND cuts.deducted > 0
         RETURNING cmp.club_id, cuts.deducted
       )
       SELECT club_id, deducted
       FROM updated`,
      [userId, clubId, pointsRequired],
    );

    const deductedTotal = deductionsResult.rows.reduce(
      (sum, row) => sum + Number(row.deducted ?? 0),
      0,
    );
    if (deductedTotal < pointsRequired) {
      throw new BadRequestException('No se pudo descontar el saldo global de puntos');
    }

    for (const row of deductionsResult.rows) {
      await client.query(
        `INSERT INTO club_points_ledger (club_id, user_id, amount, reason, reference_id)
         VALUES ($1, $2, $3, 'REWARD_REDEEM', $4)`,
        [row.club_id, userId, -Number(row.deducted), rewardId],
      );
    }

    return deductionsResult.rows;
  }

  private mapReward(row: Record<string, unknown>) {
    return {
      id: row.id,
      clubId: row.club_id,
      title: row.title,
      description: row.description,
      pointsRequired: Number(row.points_required),
      rewardType: row.reward_type,
      active: row.active,
      stock: row.stock != null ? Number(row.stock) : null,
      maxPerUser: row.max_per_user != null ? Number(row.max_per_user) : null,
      createdAt: row.created_at,
      // snake_case mirrors for older clients
      points_required: Number(row.points_required),
      reward_type: row.reward_type,
      max_per_user: row.max_per_user != null ? Number(row.max_per_user) : null,
    };
  }

  private mapRedemption(row: Record<string, unknown>) {
    return {
      id: row.id,
      clubId: row.club_id,
      userId: row.user_id,
      rewardId: row.reward_id,
      pointsSpent: Number(row.points_spent),
      status: row.status,
      redemptionCode: row.redemption_code,
      createdAt: row.created_at,
      fulfilledAt: row.fulfilled_at ?? null,
      cancelledAt: row.cancelled_at ?? null,
      cancelReason: row.cancel_reason ?? null,
      rewardTitle: row.reward_title ?? null,
      rewardType: row.reward_type ?? null,
      userName: row.user_name ?? null,
      userNickname: row.user_nickname ?? null,
      // snake_case for older web-club clients
      points_spent: Number(row.points_spent),
      redemption_code: row.redemption_code,
      reward_title: row.reward_title ?? null,
      user_name: row.user_name ?? null,
      created_at: row.created_at,
    };
  }

  private async assertClubExists(clubId: string) {
    const result = await this.db.query(`SELECT id FROM clubs WHERE id = $1`, [clubId]);
    if (!result.rows[0]) throw new NotFoundException('Club no encontrado');
  }

  private async assertClubRole(userId: string, clubId: string) {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = result.rows[0]?.role;
    if (!isClubRole(role)) {
      throw new ForbiddenException('Solo cuentas de club pueden gestionar clubes y horarios');
    }
    const admin = await this.db.query(
      `SELECT 1 FROM club_admins WHERE club_id = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM clubs WHERE id = $1 AND owner_user_id = $2
       LIMIT 1`,
      [clubId, userId],
    );
    // Fallback: many clubs use users.club_id
    if (!admin.rows[0]) {
      const owned = await this.db.query(
        `SELECT 1 FROM users WHERE id = $1 AND role IN ('CLUB', 'CLUB_ADMIN')
           AND (
             id IN (SELECT user_id FROM club_admins WHERE club_id = $2)
             OR EXISTS (SELECT 1 FROM clubs c WHERE c.id = $2)
           )
         LIMIT 1`,
        [userId, clubId],
      );
      // Mirror ClubsService.assertClubAdminOf if present
      const link = await this.db.query(
        `SELECT 1
         FROM clubs c
         LEFT JOIN club_admins ca ON ca.club_id = c.id AND ca.user_id = $2
         WHERE c.id = $1 AND (c.owner_id = $2 OR ca.user_id IS NOT NULL OR c.created_by = $2)
         LIMIT 1`,
        [clubId, userId],
      );
      // Use the same helper path as ClubsService — check assertClubAdminOf
      void owned;
      if (!link.rows[0]) {
        // Delegate to clubs table columns that exist in this schema
        await this.assertClubAdminOf(clubId, userId);
      }
    }
  }

  private async assertClubAdminOf(clubId: string, userId: string) {
    // Reuse pattern from ClubsService
    const result = await this.db.query(
      `SELECT 1 FROM clubs WHERE id = $1`,
      [clubId],
    );
    if (!result.rows[0]) throw new NotFoundException('Club no encontrado');

    const staff = await this.db.query(
      `SELECT 1
       FROM club_staff
       WHERE club_id = $1 AND user_id = $2
       LIMIT 1`,
      [clubId, userId],
    );
    if (staff.rows[0]) return;

    const manager = await this.db.query(
      `SELECT 1 FROM users WHERE id = $1 AND role IN ('CLUB', 'CLUB_ADMIN', 'ADMIN')`,
      [userId],
    );
    if (!manager.rows[0]) {
      throw new ForbiddenException('No tenés permisos sobre este club');
    }
  }
}
