import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClubGapFillService } from './club-gap-fill.service';
import { ClubsService } from './clubs.service';

export type BriefingSeverity =
  | 'info'
  | 'warn'
  | 'action'
  | 'critical'
  | 'success'
  | 'opportunity';

export type BriefingAction =
  | {
      type: 'court_slots';
      tab?: 'promotions' | 'stats' | 'slots' | 'courts';
      dayOfWeek?: number;
      hourBucket?: number;
    }
  | { type: 'billing' }
  | { type: 'auto_fill' }
  | { type: 'clients' }
  | { type: 'alerts' }
  | {
      type: 'shop';
      tab?: 'stats' | 'products' | 'matchExtras' | 'coupons' | 'redemptions';
    };

export type BriefingCard = {
  id: string;
  severity: BriefingSeverity;
  title: string;
  body: string;
  actionLabel?: string;
  action?: BriefingAction;
};

export type AlertPriority = 'critical' | 'warn' | 'info' | 'success';

export type ManagerAlert = {
  id: string;
  priority: AlertPriority;
  title: string;
  body: string;
  actionLabel?: string;
  action?: BriefingAction;
};

@Injectable()
export class ClubManagerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clubsService: ClubsService,
    private readonly gapFillService: ClubGapFillService,
    private readonly notifications: NotificationsService,
  ) {}

  async notifySegment(
    clubId: string,
    userId: string,
    input: {
      segment: 'new' | 'frequent' | 'inactive' | 'top';
      title: string;
      body: string;
      actionLabel?: string;
    },
  ) {
    await this.clubsService.requireClubAdmin(clubId, userId);
    const club = await this.clubsService.findOne(clubId);
    const recipients = await this.queryClientSegment(clubId, input.segment, 100);
    if (recipients.length === 0) {
      throw new BadRequestException('No hay jugadores en ese segmento');
    }

    let sent = 0;
    for (const row of recipients) {
      await this.notifications.create({
        userId: row.userId,
        type: 'CLUB_SEGMENT_CAMPAIGN',
        title: input.title,
        body: input.body,
        data: {
          clubId,
          clubName: club.name,
          segment: input.segment,
          actionLabel: input.actionLabel ?? null,
        },
      });
      sent += 1;
    }

    return {
      ok: true,
      segment: input.segment,
      sent,
      clubId,
      clubName: club.name,
    };
  }

  async getManagerReport(clubId: string, userId: string, periodDays = 30) {
    await this.clubsService.requireClubAdmin(clubId, userId);
    const club = await this.clubsService.findOne(clubId);
    const days = Math.min(90, Math.max(7, periodDays));

    const pricePerHour = await this.getCourtPricePerHour(clubId);
    const autoFillGapsEnabled = Boolean(club.autoFillGapsEnabled);

    const [
      today,
      byCourt,
      atRiskPlayers,
      cancellations,
      deadHours,
      weekOccupancy,
      openMatches,
      pendingDeposits,
      activePromotions,
      comparisons,
      upcomingSlots,
      lowStock,
      blockedSlots,
      clientsSummary,
    ] = await Promise.all([
      this.queryToday(clubId),
      this.queryByCourt(clubId, days, pricePerHour),
      this.queryAtRiskPlayers(clubId),
      this.queryCancellations(clubId, days),
      this.gapFillService.getDemandInsights(clubId),
      this.queryWeekOccupancy(clubId),
      this.queryOpenIncompleteMatches(clubId),
      this.queryPendingDeposits(clubId),
      this.queryActivePromotions(clubId),
      this.queryComparisons(clubId),
      this.queryUpcomingSlots(clubId),
      this.queryLowStockProducts(clubId),
      this.queryBlockedSlots(clubId),
      this.queryClientsSummary(clubId),
    ]);

    const briefingCards = this.buildBriefing({
      weekOccupancy,
      atRiskCount: atRiskPlayers.length,
      byCourt,
      autoFillGapsEnabled,
      valleys: deadHours.valleys,
      activePromotions,
      openMatches,
      pendingDeposits,
    });

    const money = (n: number) =>
      `$ ${Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const pendingHint =
      today.pendingDeposits > 0 && today.pendingShop > 0
        ? `Señas ${money(today.pendingDeposits)} · tienda ${money(today.pendingShop)}`
        : today.pendingDeposits > 0
          ? `Señas ${money(today.pendingDeposits)}`
          : today.pendingShop > 0
            ? `Tienda ${money(today.pendingShop)}`
            : 'Sin pendientes';

    const occupancyTone =
      today.occupancyPct >= 70
        ? ('success' as const)
        : today.occupancyPct >= 40
          ? ('warning' as const)
          : today.totalSlots > 0
            ? ('danger' as const)
            : ('default' as const);
    const pendingTone =
      today.pendingTotal > 0 ? ('warning' as const) : ('success' as const);
    const openTone =
      today.openSlots >= 5
        ? ('danger' as const)
        : today.openSlots >= 2
          ? ('warning' as const)
          : ('success' as const);

    const heroDeltaPct =
      today.yesterdayCollectedTotal > 0
        ? Math.round(
            ((today.collectedTotal - today.yesterdayCollectedTotal) /
              today.yesterdayCollectedTotal) *
              100,
          )
        : today.collectedTotal > 0
          ? 100
          : 0;
    const heroTone =
      heroDeltaPct > 0
        ? ('success' as const)
        : heroDeltaPct < 0
          ? ('danger' as const)
          : ('default' as const);

    const alerts = this.buildAlerts({
      pendingDeposits,
      lowStock,
      atRiskCount: atRiskPlayers.length,
      blockedSlots,
      openMatches,
      openSlotsToday: today.openSlots,
      pendingTotal: today.pendingTotal,
    });

    const alertCount = alerts.filter(
      (a) => a.priority === 'critical' || a.priority === 'warn',
    ).length;

    const insightsCards: BriefingCard[] = [...briefingCards];
    if (weekOccupancy.deltaPct > 5) {
      insightsCards.unshift({
        id: 'occupancy-up',
        severity: 'success',
        title: `La ocupación aumentó un ${weekOccupancy.deltaPct}%`,
        body: `Esta semana vas al ${weekOccupancy.thisWeekPct}% vs ${weekOccupancy.lastWeekPct}% la anterior.`,
        actionLabel: 'Ver estadísticas',
        action: { type: 'court_slots', tab: 'stats' },
      });
    }
    if (atRiskPlayers[0]) {
      const p = atRiskPlayers[0];
      insightsCards.push({
        id: `inactive-${p.userId}`,
        severity: 'opportunity',
        title: `Hace ${p.daysSince} días que ${p.nickname || p.name} no reserva`,
        body: `${p.matchesAtClub} partidos en el club. Un mensaje o promo puede recuperarlo.`,
        actionLabel: 'Ver clientes',
        action: { type: 'clients' },
      });
    }

    const uniqueInsights = insightsCards
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
      .slice(0, 6);

    return {
      clubId,
      clubName: club.name,
      periodDays: days,
      generatedAt: new Date().toISOString(),
      autoFillGapsEnabled,
      alertCount,
      intro: `Indicadores de ${club.name} · actualizado ${new Date().toLocaleString('es-AR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      hero: {
        title: 'Facturación del día',
        amount: today.collectedTotal,
        amountLabel: money(today.collectedTotal),
        deltaPct: heroDeltaPct,
        deltaLabel:
          today.yesterdayCollectedTotal > 0 || today.collectedTotal > 0
            ? `${heroDeltaPct >= 0 ? '+' : ''}${heroDeltaPct}% respecto ayer`
            : 'Sin datos de ayer',
        hint: `Señas ${money(today.collectedDeposits)} · tienda ${money(today.collectedShop)}`,
        tone: heroTone,
      },
      comparisons: {
        title: 'Comparativas',
        metrics: comparisons,
      },
      today: {
        title: 'Hoy',
        subtitle: `${club.name} · ocupación y cobros del día`,
        tiles: [
          {
            id: 'occupancy',
            label: 'Ocupación',
            value: `${today.occupancyPct}%`,
            hint: `${today.bookedSlots}/${today.totalSlots} turnos`,
            tone: 'primary' as const,
            statusTone: occupancyTone,
          },
          {
            id: 'collected',
            label: 'Cobrado',
            value: money(today.collectedTotal),
            hint: `Señas ${money(today.collectedDeposits)} · tienda ${money(today.collectedShop)}`,
            tone: 'accent' as const,
            statusTone: 'success' as const,
          },
          {
            id: 'pending',
            label: 'Pendiente',
            value: money(today.pendingTotal),
            hint: pendingHint,
            statusTone: pendingTone,
          },
          {
            id: 'open',
            label: 'Horas muertas',
            value: String(today.openSlots),
            hint:
              today.openSlots === 1
                ? '1 turno sin reservar'
                : `${today.openSlots} turnos sin reservar`,
            statusTone: openTone,
          },
        ],
      },
      briefing: {
        title: 'Qué hacer ahora',
        subtitle: `${briefingCards.length} recomendación${briefingCards.length === 1 ? '' : 'es'} según tu operación`,
        emptyText:
          'Sin alertas urgentes por ahora. Cuando haya huecos, churn o señas pendientes van a aparecer acá.',
        cards: briefingCards,
      },
      insights: {
        title: 'Insights',
        subtitle: 'Señales de negocio y próximas acciones',
        emptyText:
          'Todo en orden. Cuando haya franjas valle, señas o churn van a aparecer acá.',
        cards: uniqueInsights,
      },
      upcomingSlots: {
        title: 'Próximos turnos',
        subtitle: 'Hoy y mañana',
        emptyText: 'No hay turnos publicados en las próximas horas.',
        rows: upcomingSlots.map((s) => ({
          id: s.id,
          timeLabel: s.timeLabel,
          courtLabel: s.courtLabel,
          playerLabel: s.playerLabel,
          status: s.status,
        })),
        action: {
          label: 'Ver agenda',
          action: { type: 'court_slots' as const, tab: 'slots' as const },
        },
      },
      byCourt: {
        title: 'Ingresos por cancha',
        subtitle: `Últimos ${days} días · estimado con tarifa ${money(pricePerHour)}/h`,
        emptyText: 'Todavía no hay turnos suficientes para desglosar por cancha.',
        rows: byCourt.map((c) => ({
          courtId: c.courtId,
          courtLabel: c.courtLabel,
          detail: `${c.occupancyPct}% ocupación · ${c.bookedHours}h reservadas · ${c.bookedSlots}/${c.totalSlots} turnos`,
          revenueLabel: money(c.estimatedRevenue),
        })),
      },
      atRisk: {
        title: 'Clientes que dejan de venir',
        subtitle: `${atRiskPlayers.length} regulares (≥3 partidos) sin reservar hace 21+ días`,
        emptyText: 'Ningún habitual en riesgo en este momento.',
        rows: atRiskPlayers.slice(0, 8).map((p) => ({
          userId: p.userId,
          name: p.name,
          nickname: p.nickname,
          photoUrl: p.photoUrl,
          detail: `${p.matchesAtClub} partidos · hace ${p.daysSince} días`,
        })),
        moreLabel:
          atRiskPlayers.length > 8 ? `+${atRiskPlayers.length - 8} más` : undefined,
        action:
          atRiskPlayers.length > 0
            ? {
                label: 'Ver clientes',
                action: { type: 'clients' as const },
              }
            : undefined,
      },
      cancellations: {
        title: 'Cancelaciones',
        subtitle: `Últimos ${days} días`,
        refundedLabel: 'Reembolsado',
        refundedAmount: money(cancellations.refundedAmount),
        refundedDetail: `${cancellations.refundedCount} señas`,
        retainedLabel: 'Retenido',
        retainedAmount: money(cancellations.retainedAmount),
        retainedDetail: `${cancellations.retainedCount} señas`,
        summary: `${cancellations.cancelledMatches} partidos cancelados en el período.`,
        action: {
          label: 'Ver movimientos',
          action: { type: 'billing' as const },
        },
      },
      deadHours: {
        title: 'Horas muertas',
        subtitle: `Ocupación < ${deadHours.occupancyThresholdPct}% · últimos ${deadHours.historyDays} días`,
        emptyText:
          'Todavía no hay suficientes datos históricos para detectar franjas valle.',
        rows: deadHours.valleys.slice(0, 8).map((v) => {
          const freeHours = Math.max(0, v.totalSlots - v.bookedSlots);
          const lostRevenue = Math.round(freeHours * pricePerHour);
          return {
            id: `${v.dayOfWeek}-${v.hourBucket}`,
            title: `${dayNames[v.dayOfWeek] ?? 'Día'} · ${String(v.hourBucket).padStart(2, '0')}:00–${String(
              v.hourBucket + 1,
            ).padStart(2, '0')}:00`,
            detail: `Ocupación ${v.occupancyPct}% · ${v.candidateCount} candidatos · ${v.bookedSlots}/${v.totalSlots} turnos`,
            freeHours,
            lostRevenue,
            lostRevenueLabel: money(lostRevenue),
            dayOfWeek: v.dayOfWeek,
            hourBucket: v.hourBucket,
            action: {
              label: 'Crear promoción',
              action: {
                type: 'court_slots' as const,
                tab: 'promotions' as const,
                dayOfWeek: v.dayOfWeek,
                hourBucket: v.hourBucket,
              },
            },
          };
        }),
        action: deadHours.valleys.length
          ? {
              label: autoFillGapsEnabled
                ? 'Ver relleno automático'
                : 'Activar relleno automático',
              action: autoFillGapsEnabled
                ? ({ type: 'court_slots' as const, tab: 'stats' as const })
                : ({ type: 'auto_fill' as const }),
            }
          : undefined,
      },
      alerts: {
        title: 'Alertas',
        subtitle: `${alerts.length} señal${alerts.length === 1 ? '' : 'es'} operativas`,
        emptyText: 'Sin alertas. El club está operando con normalidad.',
        rows: alerts,
      },
      clientsSummary: {
        title: 'Clientes',
        subtitle: 'Resumen de la base del club',
        counts: clientsSummary.counts,
        segments: clientsSummary.segments,
        action: {
          label: 'Ver todos',
          action: { type: 'clients' as const },
        },
      },
    };
  }

  private async getCourtPricePerHour(clubId: string): Promise<number> {
    const result = await this.db.query<{ court_price_per_hour: number }>(
      `SELECT COALESCE(court_price_per_hour, 0)::float8 AS court_price_per_hour
       FROM clubs WHERE id = $1`,
      [clubId],
    );
    return Number(result.rows[0]?.court_price_per_hour ?? 0);
  }

  private async queryToday(clubId: string) {
    const [slots, collected, pending, yesterday] = await Promise.all([
      this.db.query<{
        open_slots: number;
        booked_slots: number;
        total_slots: number;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_slots,
           COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked_slots,
           COUNT(*) FILTER (WHERE status IN ('OPEN', 'BOOKED'))::int AS total_slots
         FROM court_availability_slots
         WHERE club_id = $1 AND slot_date = CURRENT_DATE`,
        [clubId],
      ),
      this.db.query<{ deposits: number; shop: number }>(
        `SELECT
           COALESCE((
             SELECT SUM(md.amount)
             FROM match_deposits md
             INNER JOIN matches m ON m.id = md.match_id
             WHERE m.club_id = $1
               AND md.status = 'APPROVED'
               AND COALESCE(md.paid_at, md.updated_at)::date = CURRENT_DATE
           ), 0)::float8 AS deposits,
           COALESCE((
             SELECT SUM(sp.subtotal)
             FROM shop_purchases sp
             WHERE sp.club_id = $1
               AND sp.status = 'CONFIRMED'
               AND sp.created_at::date = CURRENT_DATE
           ), 0)::float8 AS shop`,
        [clubId],
      ),
      this.db.query<{ deposits: number; shop: number }>(
        `SELECT
           COALESCE((
             SELECT SUM(md.amount)
             FROM match_deposits md
             INNER JOIN matches m ON m.id = md.match_id
             WHERE m.club_id = $1 AND md.status = 'PENDING'
           ), 0)::float8 AS deposits,
           COALESCE((
             SELECT SUM(sp.subtotal)
             FROM shop_purchases sp
             WHERE sp.club_id = $1 AND sp.status = 'PENDING'
           ), 0)::float8 AS shop`,
        [clubId],
      ),
      this.db.query<{ deposits: number; shop: number }>(
        `SELECT
           COALESCE((
             SELECT SUM(md.amount)
             FROM match_deposits md
             INNER JOIN matches m ON m.id = md.match_id
             WHERE m.club_id = $1
               AND md.status = 'APPROVED'
               AND COALESCE(md.paid_at, md.updated_at)::date = CURRENT_DATE - 1
           ), 0)::float8 AS deposits,
           COALESCE((
             SELECT SUM(sp.subtotal)
             FROM shop_purchases sp
             WHERE sp.club_id = $1
               AND sp.status = 'CONFIRMED'
               AND sp.created_at::date = CURRENT_DATE - 1
           ), 0)::float8 AS shop`,
        [clubId],
      ),
    ]);

    const openSlots = slots.rows[0]?.open_slots ?? 0;
    const bookedSlots = slots.rows[0]?.booked_slots ?? 0;
    const totalSlots = slots.rows[0]?.total_slots ?? 0;
    const occupancyPct =
      totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;
    const collectedDeposits = Number(collected.rows[0]?.deposits ?? 0);
    const collectedShop = Number(collected.rows[0]?.shop ?? 0);
    const pendingDeposits = Number(pending.rows[0]?.deposits ?? 0);
    const pendingShop = Number(pending.rows[0]?.shop ?? 0);
    const yesterdayDeposits = Number(yesterday.rows[0]?.deposits ?? 0);
    const yesterdayShop = Number(yesterday.rows[0]?.shop ?? 0);

    return {
      occupancyPct,
      openSlots,
      bookedSlots,
      totalSlots,
      collectedTotal: collectedDeposits + collectedShop,
      collectedDeposits,
      collectedShop,
      pendingTotal: pendingDeposits + pendingShop,
      pendingDeposits,
      pendingShop,
      yesterdayCollectedTotal: yesterdayDeposits + yesterdayShop,
    };
  }

  private async queryComparisons(clubId: string) {
    const result = await this.db.query<{
      rev_today: number;
      rev_yesterday: number;
      rev_this_week: number;
      rev_last_week: number;
      rev_this_month: number;
      rev_last_month: number;
      occ_today_booked: number;
      occ_today_total: number;
      occ_yesterday_booked: number;
      occ_yesterday_total: number;
      occ_this_week_booked: number;
      occ_this_week_total: number;
      occ_last_week_booked: number;
      occ_last_week_total: number;
      occ_this_month_booked: number;
      occ_this_month_total: number;
      occ_last_month_booked: number;
      occ_last_month_total: number;
      book_today: number;
      book_yesterday: number;
      book_this_week: number;
      book_last_week: number;
      book_this_month: number;
      book_last_month: number;
    }>(
      `SELECT
         COALESCE((
           SELECT SUM(md.amount) FROM match_deposits md
           INNER JOIN matches m ON m.id = md.match_id
           WHERE m.club_id = $1 AND md.status = 'APPROVED'
             AND COALESCE(md.paid_at, md.updated_at)::date = CURRENT_DATE
         ), 0)::float8 + COALESCE((
           SELECT SUM(sp.subtotal) FROM shop_purchases sp
           WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
             AND sp.created_at::date = CURRENT_DATE
         ), 0)::float8 AS rev_today,
         COALESCE((
           SELECT SUM(md.amount) FROM match_deposits md
           INNER JOIN matches m ON m.id = md.match_id
           WHERE m.club_id = $1 AND md.status = 'APPROVED'
             AND COALESCE(md.paid_at, md.updated_at)::date = CURRENT_DATE - 1
         ), 0)::float8 + COALESCE((
           SELECT SUM(sp.subtotal) FROM shop_purchases sp
           WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
             AND sp.created_at::date = CURRENT_DATE - 1
         ), 0)::float8 AS rev_yesterday,
         COALESCE((
           SELECT SUM(md.amount) FROM match_deposits md
           INNER JOIN matches m ON m.id = md.match_id
           WHERE m.club_id = $1 AND md.status = 'APPROVED'
             AND COALESCE(md.paid_at, md.updated_at)::date >= date_trunc('week', CURRENT_DATE)::date
         ), 0)::float8 + COALESCE((
           SELECT SUM(sp.subtotal) FROM shop_purchases sp
           WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
             AND sp.created_at::date >= date_trunc('week', CURRENT_DATE)::date
         ), 0)::float8 AS rev_this_week,
         COALESCE((
           SELECT SUM(md.amount) FROM match_deposits md
           INNER JOIN matches m ON m.id = md.match_id
           WHERE m.club_id = $1 AND md.status = 'APPROVED'
             AND COALESCE(md.paid_at, md.updated_at)::date >= date_trunc('week', CURRENT_DATE)::date - 7
             AND COALESCE(md.paid_at, md.updated_at)::date < date_trunc('week', CURRENT_DATE)::date
         ), 0)::float8 + COALESCE((
           SELECT SUM(sp.subtotal) FROM shop_purchases sp
           WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
             AND sp.created_at::date >= date_trunc('week', CURRENT_DATE)::date - 7
             AND sp.created_at::date < date_trunc('week', CURRENT_DATE)::date
         ), 0)::float8 AS rev_last_week,
         COALESCE((
           SELECT SUM(md.amount) FROM match_deposits md
           INNER JOIN matches m ON m.id = md.match_id
           WHERE m.club_id = $1 AND md.status = 'APPROVED'
             AND COALESCE(md.paid_at, md.updated_at)::date >= date_trunc('month', CURRENT_DATE)::date
         ), 0)::float8 + COALESCE((
           SELECT SUM(sp.subtotal) FROM shop_purchases sp
           WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
             AND sp.created_at::date >= date_trunc('month', CURRENT_DATE)::date
         ), 0)::float8 AS rev_this_month,
         COALESCE((
           SELECT SUM(md.amount) FROM match_deposits md
           INNER JOIN matches m ON m.id = md.match_id
           WHERE m.club_id = $1 AND md.status = 'APPROVED'
             AND COALESCE(md.paid_at, md.updated_at)::date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
             AND COALESCE(md.paid_at, md.updated_at)::date < date_trunc('month', CURRENT_DATE)::date
         ), 0)::float8 + COALESCE((
           SELECT SUM(sp.subtotal) FROM shop_purchases sp
           WHERE sp.club_id = $1 AND sp.status = 'CONFIRMED'
             AND sp.created_at::date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
             AND sp.created_at::date < date_trunc('month', CURRENT_DATE)::date
         ), 0)::float8 AS rev_last_month,
         (SELECT COUNT(*) FILTER (WHERE status = 'BOOKED')::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date = CURRENT_DATE) AS occ_today_booked,
         (SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date = CURRENT_DATE) AS occ_today_total,
         (SELECT COUNT(*) FILTER (WHERE status = 'BOOKED')::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date = CURRENT_DATE - 1) AS occ_yesterday_booked,
         (SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date = CURRENT_DATE - 1) AS occ_yesterday_total,
         (SELECT COUNT(*) FILTER (WHERE status = 'BOOKED')::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date >= date_trunc('week', CURRENT_DATE)::date
             AND slot_date < date_trunc('week', CURRENT_DATE)::date + 7) AS occ_this_week_booked,
         (SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date >= date_trunc('week', CURRENT_DATE)::date
             AND slot_date < date_trunc('week', CURRENT_DATE)::date + 7) AS occ_this_week_total,
         (SELECT COUNT(*) FILTER (WHERE status = 'BOOKED')::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date >= date_trunc('week', CURRENT_DATE)::date - 7
             AND slot_date < date_trunc('week', CURRENT_DATE)::date) AS occ_last_week_booked,
         (SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date >= date_trunc('week', CURRENT_DATE)::date - 7
             AND slot_date < date_trunc('week', CURRENT_DATE)::date) AS occ_last_week_total,
         (SELECT COUNT(*) FILTER (WHERE status = 'BOOKED')::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date >= date_trunc('month', CURRENT_DATE)::date) AS occ_this_month_booked,
         (SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int FROM court_availability_slots
           WHERE club_id = $1 AND slot_date >= date_trunc('month', CURRENT_DATE)::date) AS occ_this_month_total,
         (SELECT COUNT(*) FILTER (WHERE status = 'BOOKED')::int FROM court_availability_slots
           WHERE club_id = $1
             AND slot_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
             AND slot_date < date_trunc('month', CURRENT_DATE)::date) AS occ_last_month_booked,
         (SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int FROM court_availability_slots
           WHERE club_id = $1
             AND slot_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
             AND slot_date < date_trunc('month', CURRENT_DATE)::date) AS occ_last_month_total,
         (SELECT COUNT(*)::int FROM court_availability_slots
           WHERE club_id = $1 AND status = 'BOOKED' AND slot_date = CURRENT_DATE) AS book_today,
         (SELECT COUNT(*)::int FROM court_availability_slots
           WHERE club_id = $1 AND status = 'BOOKED' AND slot_date = CURRENT_DATE - 1) AS book_yesterday,
         (SELECT COUNT(*)::int FROM court_availability_slots
           WHERE club_id = $1 AND status = 'BOOKED'
             AND slot_date >= date_trunc('week', CURRENT_DATE)::date) AS book_this_week,
         (SELECT COUNT(*)::int FROM court_availability_slots
           WHERE club_id = $1 AND status = 'BOOKED'
             AND slot_date >= date_trunc('week', CURRENT_DATE)::date - 7
             AND slot_date < date_trunc('week', CURRENT_DATE)::date) AS book_last_week,
         (SELECT COUNT(*)::int FROM court_availability_slots
           WHERE club_id = $1 AND status = 'BOOKED'
             AND slot_date >= date_trunc('month', CURRENT_DATE)::date) AS book_this_month,
         (SELECT COUNT(*)::int FROM court_availability_slots
           WHERE club_id = $1 AND status = 'BOOKED'
             AND slot_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
             AND slot_date < date_trunc('month', CURRENT_DATE)::date) AS book_last_month
      `,
      [clubId],
    );

    const r = result.rows[0];
    const pct = (curr: number, prev: number) => {
      if (prev <= 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };
    const occPct = (booked: number, total: number) =>
      total > 0 ? Math.round((booked / total) * 100) : 0;

    const occToday = occPct(r?.occ_today_booked ?? 0, r?.occ_today_total ?? 0);
    const occYesterday = occPct(
      r?.occ_yesterday_booked ?? 0,
      r?.occ_yesterday_total ?? 0,
    );
    const occThisWeek = occPct(
      r?.occ_this_week_booked ?? 0,
      r?.occ_this_week_total ?? 0,
    );
    const occLastWeek = occPct(
      r?.occ_last_week_booked ?? 0,
      r?.occ_last_week_total ?? 0,
    );
    const occThisMonth = occPct(
      r?.occ_this_month_booked ?? 0,
      r?.occ_this_month_total ?? 0,
    );
    const occLastMonth = occPct(
      r?.occ_last_month_booked ?? 0,
      r?.occ_last_month_total ?? 0,
    );

    return [
      {
        id: 'revenue',
        label: 'Facturación',
        vsYesterdayPct: pct(Number(r?.rev_today ?? 0), Number(r?.rev_yesterday ?? 0)),
        vsWeekPct: pct(Number(r?.rev_this_week ?? 0), Number(r?.rev_last_week ?? 0)),
        vsMonthPct: pct(Number(r?.rev_this_month ?? 0), Number(r?.rev_last_month ?? 0)),
      },
      {
        id: 'occupancy',
        label: 'Ocupación',
        vsYesterdayPct: occToday - occYesterday,
        vsWeekPct: occThisWeek - occLastWeek,
        vsMonthPct: occThisMonth - occLastMonth,
      },
      {
        id: 'bookings',
        label: 'Reservas',
        vsYesterdayPct: pct(r?.book_today ?? 0, r?.book_yesterday ?? 0),
        vsWeekPct: pct(r?.book_this_week ?? 0, r?.book_last_week ?? 0),
        vsMonthPct: pct(r?.book_this_month ?? 0, r?.book_last_month ?? 0),
      },
    ];
  }

  private async queryUpcomingSlots(clubId: string) {
    const result = await this.db.query<{
      id: string;
      slot_date: string;
      start_hour: number;
      status: string;
      court_label: string;
      player_name: string | null;
    }>(
      `SELECT cas.id,
              cas.slot_date::text AS slot_date,
              cas.start_hour::float8 AS start_hour,
              cas.status,
              COALESCE(c.name, cas.court_label, 'Cancha') AS court_label,
              (
                SELECT COALESCE(p.nickname, u.name)
                FROM matches m
                INNER JOIN match_players mp
                  ON mp.match_id = m.id AND mp.status IN ('JOINED', 'CONFIRMED')
                INNER JOIN players p ON p.id = mp.player_id
                INNER JOIN users u ON u.id = p.user_id
                WHERE m.court_slot_id = cas.id
                ORDER BY mp.created_at ASC
                LIMIT 1
              ) AS player_name
       FROM court_availability_slots cas
       LEFT JOIN courts c ON c.id = cas.court_id
       WHERE cas.club_id = $1
         AND cas.status IN ('OPEN', 'BOOKED')
         AND (
           (cas.slot_date = CURRENT_DATE
             AND cas.start_hour >= EXTRACT(HOUR FROM NOW())::float8 + EXTRACT(MINUTE FROM NOW())::float8 / 60.0)
           OR cas.slot_date = CURRENT_DATE + 1
         )
       ORDER BY cas.slot_date ASC, cas.start_hour ASC
       LIMIT 8`,
      [clubId],
    );

    const formatHour = (h: number) => {
      const hours = Math.floor(h);
      const mins = Math.round((h - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    return result.rows.map((row) => {
      const isToday = row.slot_date?.startsWith(
        new Date().toISOString().slice(0, 10),
      );
      const timeBase = formatHour(Number(row.start_hour));
      return {
        id: row.id,
        timeLabel: isToday ? timeBase : `Mañ ${timeBase}`,
        courtLabel: row.court_label,
        playerLabel:
          row.status === 'BOOKED'
            ? row.player_name || 'Reservado'
            : 'Libre',
        status: row.status as 'OPEN' | 'BOOKED',
      };
    });
  }

  private async queryLowStockProducts(clubId: string) {
    const result = await this.db.query<{
      id: string;
      name: string;
      stock_quantity: number;
    }>(
      `SELECT id, name, stock_quantity
       FROM club_shop_products
       WHERE club_id = $1
         AND active = TRUE
         AND stock_quantity IS NOT NULL
         AND stock_quantity <= 3
       ORDER BY stock_quantity ASC, name ASC
       LIMIT 10`,
      [clubId],
    );
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      stock: r.stock_quantity,
    }));
  }

  private async queryBlockedSlots(clubId: string) {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM court_availability_slots
       WHERE club_id = $1
         AND status = 'CANCELLED'
         AND slot_date >= CURRENT_DATE
         AND slot_date <= CURRENT_DATE + 7`,
      [clubId],
    );
    return result.rows[0]?.count ?? 0;
  }

  private async queryClientsSummary(clubId: string) {
    const [counts, newClients, frequent, inactive, top] = await Promise.all([
      this.db.query<{
        new_count: number;
        frequent_count: number;
        inactive_count: number;
        top_count: number;
      }>(
        `SELECT
           COUNT(*) FILTER (
             WHERE cmp.last_played_at >= NOW() - INTERVAL '14 days'
               AND cmp.matches_at_club <= 2
           )::int AS new_count,
           COUNT(*) FILTER (
             WHERE cmp.matches_at_club >= 5
               AND cmp.last_played_at >= NOW() - INTERVAL '21 days'
           )::int AS frequent_count,
           COUNT(*) FILTER (
             WHERE cmp.matches_at_club >= 3
               AND cmp.last_played_at < NOW() - INTERVAL '21 days'
           )::int AS inactive_count,
           COUNT(*) FILTER (WHERE cmp.matches_at_club >= 1)::int AS top_count
         FROM club_member_points cmp
         WHERE cmp.club_id = $1`,
        [clubId],
      ),
      this.queryClientSegment(clubId, 'new'),
      this.queryClientSegment(clubId, 'frequent'),
      this.queryClientSegment(clubId, 'inactive'),
      this.queryClientSegment(clubId, 'top'),
    ]);

    const c = counts.rows[0];
    return {
      counts: {
        new: c?.new_count ?? 0,
        frequent: c?.frequent_count ?? 0,
        inactive: c?.inactive_count ?? 0,
        top: Math.min(c?.top_count ?? 0, 20),
      },
      segments: {
        new: newClients,
        frequent,
        inactive,
        top,
      },
    };
  }

  private async queryClientSegment(
    clubId: string,
    segment: 'new' | 'frequent' | 'inactive' | 'top',
    limit = 12,
  ) {
    let where = '';
    let order = 'cmp.last_played_at DESC NULLS LAST';
    if (segment === 'new') {
      where = `AND cmp.last_played_at >= NOW() - INTERVAL '14 days' AND cmp.matches_at_club <= 2`;
    } else if (segment === 'frequent') {
      where = `AND cmp.matches_at_club >= 5 AND cmp.last_played_at >= NOW() - INTERVAL '21 days'`;
    } else if (segment === 'inactive') {
      where = `AND cmp.matches_at_club >= 3 AND cmp.last_played_at < NOW() - INTERVAL '21 days'`;
      order = 'cmp.last_played_at ASC NULLS LAST';
    } else {
      where = `AND cmp.matches_at_club >= 1`;
      order = 'cmp.matches_at_club DESC, cmp.points DESC';
    }

    const safeLimit = Math.min(200, Math.max(1, limit));

    const result = await this.db.query<{
      user_id: string;
      name: string;
      nickname: string | null;
      photo_url: string | null;
      matches_at_club: number;
      last_played_at: string | null;
      days_since: number | null;
      spent: number;
      debt: number;
    }>(
      `SELECT cmp.user_id,
              u.name,
              p.nickname,
              p.photo_url,
              cmp.matches_at_club,
              cmp.last_played_at,
              CASE WHEN cmp.last_played_at IS NULL THEN NULL
                   ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - cmp.last_played_at)) / 86400))::int
              END AS days_since,
              COALESCE((
                SELECT SUM(md.amount)
                FROM match_deposits md
                INNER JOIN matches m ON m.id = md.match_id
                INNER JOIN match_players mp ON mp.match_id = m.id
                INNER JOIN players pl ON pl.id = mp.player_id
                WHERE m.club_id = $1 AND pl.user_id = cmp.user_id AND md.status = 'APPROVED'
              ), 0)::float8 + COALESCE((
                SELECT SUM(sp.subtotal)
                FROM shop_purchases sp
                WHERE sp.club_id = $1 AND sp.user_id = cmp.user_id AND sp.status = 'CONFIRMED'
              ), 0)::float8 AS spent,
              COALESCE((
                SELECT SUM(md.amount)
                FROM match_deposits md
                INNER JOIN matches m ON m.id = md.match_id
                INNER JOIN match_players mp ON mp.match_id = m.id
                INNER JOIN players pl ON pl.id = mp.player_id
                WHERE m.club_id = $1 AND pl.user_id = cmp.user_id AND md.status = 'PENDING'
              ), 0)::float8 AS debt
       FROM club_member_points cmp
       INNER JOIN users u ON u.id = cmp.user_id
       LEFT JOIN players p ON p.user_id = cmp.user_id
       WHERE cmp.club_id = $1
         ${where}
       ORDER BY ${order}
       LIMIT $2`,
      [clubId, safeLimit],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      nickname: row.nickname,
      photoUrl: row.photo_url,
      matchesAtClub: row.matches_at_club,
      lastPlayedAt: row.last_played_at,
      daysSince: row.days_since,
      spent: Math.round(Number(row.spent ?? 0)),
      debt: Math.round(Number(row.debt ?? 0)),
    }));
  }

  private buildAlerts(input: {
    pendingDeposits: { amount: number; count: number };
    lowStock: Array<{ id: string; name: string; stock: number }>;
    atRiskCount: number;
    blockedSlots: number;
    openMatches: Array<{ id: string }>;
    openSlotsToday: number;
    pendingTotal: number;
  }): ManagerAlert[] {
    const alerts: ManagerAlert[] = [];

    if (input.pendingDeposits.count > 0) {
      alerts.push({
        id: 'pending-deposits',
        priority: 'critical',
        title: `${input.pendingDeposits.count} reservas sin seña`,
        body: `Hay ~${Math.round(input.pendingDeposits.amount).toLocaleString('es-AR')} pendiente de cobro.`,
        actionLabel: 'Cobrar',
        action: { type: 'billing' },
      });
    }

    if (input.openMatches.length > 0) {
      alerts.push({
        id: 'incomplete-matches',
        priority: 'warn',
        title: `${input.openMatches.length} partidos incompletos`,
        body: 'Reservas abiertas sin cupo completo en los próximos 7 días.',
        actionLabel: 'Ver horarios',
        action: { type: 'court_slots', tab: 'slots' },
      });
    }

    if (input.lowStock.length > 0) {
      const names = input.lowStock
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ');
      alerts.push({
        id: 'low-stock',
        priority: 'warn',
        title: `${input.lowStock.length} productos con poco stock`,
        body: names,
        actionLabel: 'Ver inventario',
        action: { type: 'shop', tab: 'products' },
      });
    }

    if (input.atRiskCount > 0) {
      alerts.push({
        id: 'churn',
        priority: 'warn',
        title: `${input.atRiskCount} clientes con deuda de atención`,
        body: 'Habituales sin reservar hace 21+ días.',
        actionLabel: 'Ver clientes',
        action: { type: 'clients' },
      });
    }

    if (input.blockedSlots > 0) {
      alerts.push({
        id: 'blocked-slots',
        priority: 'info',
        title: `${input.blockedSlots} canchas bloqueadas`,
        body: 'Turnos cancelados/bloqueados en los próximos 7 días.',
        actionLabel: 'Ver agenda',
        action: { type: 'court_slots', tab: 'slots' },
      });
    }

    if (input.openSlotsToday >= 5) {
      alerts.push({
        id: 'open-today',
        priority: 'info',
        title: `${input.openSlotsToday} huecos abiertos hoy`,
        body: 'Oportunidad de promocionar franjas libres.',
        actionLabel: 'Crear promo',
        action: { type: 'court_slots', tab: 'promotions' },
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'all-good',
        priority: 'success',
        title: 'Operación estable',
        body: 'Sin alertas críticas por ahora.',
      });
    }

    return alerts;
  }

  private async queryByCourt(clubId: string, days: number, pricePerHour: number) {
    const result = await this.db.query<{
      court_id: string | null;
      court_label: string;
      total_slots: number;
      booked_slots: number;
      booked_hours: number;
    }>(
      `SELECT cas.court_id,
              COALESCE(c.name, cas.court_label, 'Sin cancha') AS court_label,
              COUNT(*) FILTER (WHERE cas.status IN ('OPEN', 'BOOKED', 'CANCELLED'))::int AS total_slots,
              COUNT(*) FILTER (WHERE cas.status = 'BOOKED')::int AS booked_slots,
              COALESCE(
                SUM(cas.end_hour - cas.start_hour) FILTER (WHERE cas.status = 'BOOKED'),
                0
              )::float8 AS booked_hours
       FROM court_availability_slots cas
       LEFT JOIN courts c ON c.id = cas.court_id
       WHERE cas.club_id = $1
         AND cas.slot_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
         AND cas.slot_date < CURRENT_DATE + INTERVAL '1 day'
       GROUP BY cas.court_id, COALESCE(c.name, cas.court_label, 'Sin cancha')
       ORDER BY booked_hours DESC, court_label ASC`,
      [clubId, days],
    );

    return result.rows.map((row) => {
      const total = row.total_slots ?? 0;
      const booked = row.booked_slots ?? 0;
      const bookedHours = Number(row.booked_hours ?? 0);
      return {
        courtId: row.court_id,
        courtLabel: row.court_label,
        totalSlots: total,
        bookedSlots: booked,
        bookedHours: Math.round(bookedHours * 10) / 10,
        occupancyPct: total > 0 ? Math.round((booked / total) * 100) : 0,
        estimatedRevenue: Math.round(bookedHours * pricePerHour),
      };
    });
  }

  private async queryAtRiskPlayers(clubId: string) {
    const result = await this.db.query<{
      user_id: string;
      name: string;
      nickname: string | null;
      photo_url: string | null;
      matches_at_club: number;
      last_played_at: string | null;
      days_since: number;
    }>(
      `SELECT cmp.user_id,
              u.name,
              p.nickname,
              p.photo_url,
              cmp.matches_at_club,
              cmp.last_played_at,
              GREATEST(
                0,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - cmp.last_played_at)) / 86400)
              )::int AS days_since
       FROM club_member_points cmp
       INNER JOIN users u ON u.id = cmp.user_id
       LEFT JOIN players p ON p.user_id = cmp.user_id
       WHERE cmp.club_id = $1
         AND cmp.matches_at_club >= 3
         AND cmp.last_played_at IS NOT NULL
         AND cmp.last_played_at < NOW() - INTERVAL '21 days'
       ORDER BY cmp.last_played_at ASC
       LIMIT 20`,
      [clubId],
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      nickname: row.nickname,
      photoUrl: row.photo_url,
      matchesAtClub: row.matches_at_club,
      lastPlayedAt: row.last_played_at,
      daysSince: row.days_since,
    }));
  }

  private async queryCancellations(clubId: string, days: number) {
    const [refunds, retained, cancelledMatches] = await Promise.all([
      this.db.query<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(md.amount), 0)::float8 AS total, COUNT(*)::int AS count
         FROM match_deposits md
         INNER JOIN matches m ON m.id = md.match_id
         WHERE m.club_id = $1
           AND md.status = 'REFUNDED'
           AND COALESCE(md.updated_at, md.paid_at) >= NOW() - ($2::int * INTERVAL '1 day')`,
        [clubId, days],
      ),
      this.db.query<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(md.amount), 0)::float8 AS total, COUNT(*)::int AS count
         FROM match_deposits md
         INNER JOIN matches m ON m.id = md.match_id
         WHERE m.club_id = $1
           AND m.status = 'CANCELLED'
           AND md.status = 'APPROVED'
           AND m.updated_at >= NOW() - ($2::int * INTERVAL '1 day')`,
        [clubId, days],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM matches m
         WHERE m.club_id = $1
           AND m.status = 'CANCELLED'
           AND m.updated_at >= NOW() - ($2::int * INTERVAL '1 day')`,
        [clubId, days],
      ),
    ]);

    return {
      refundedAmount: Number(refunds.rows[0]?.total ?? 0),
      refundedCount: refunds.rows[0]?.count ?? 0,
      retainedAmount: Number(retained.rows[0]?.total ?? 0),
      retainedCount: retained.rows[0]?.count ?? 0,
      cancelledMatches: cancelledMatches.rows[0]?.count ?? 0,
    };
  }

  private async queryWeekOccupancy(clubId: string) {
    const result = await this.db.query<{
      this_week_total: number;
      this_week_booked: number;
      last_week_total: number;
      last_week_booked: number;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE slot_date >= date_trunc('week', CURRENT_DATE)::date
             AND slot_date < date_trunc('week', CURRENT_DATE)::date + 7
             AND status IN ('OPEN', 'BOOKED', 'CANCELLED')
         )::int AS this_week_total,
         COUNT(*) FILTER (
           WHERE slot_date >= date_trunc('week', CURRENT_DATE)::date
             AND slot_date < date_trunc('week', CURRENT_DATE)::date + 7
             AND status = 'BOOKED'
         )::int AS this_week_booked,
         COUNT(*) FILTER (
           WHERE slot_date >= date_trunc('week', CURRENT_DATE)::date - 7
             AND slot_date < date_trunc('week', CURRENT_DATE)::date
             AND status IN ('OPEN', 'BOOKED', 'CANCELLED')
         )::int AS last_week_total,
         COUNT(*) FILTER (
           WHERE slot_date >= date_trunc('week', CURRENT_DATE)::date - 7
             AND slot_date < date_trunc('week', CURRENT_DATE)::date
             AND status = 'BOOKED'
         )::int AS last_week_booked
       FROM court_availability_slots
       WHERE club_id = $1`,
      [clubId],
    );

    const row = result.rows[0];
    const thisTotal = row?.this_week_total ?? 0;
    const thisBooked = row?.this_week_booked ?? 0;
    const lastTotal = row?.last_week_total ?? 0;
    const lastBooked = row?.last_week_booked ?? 0;
    const thisPct = thisTotal > 0 ? Math.round((thisBooked / thisTotal) * 100) : 0;
    const lastPct = lastTotal > 0 ? Math.round((lastBooked / lastTotal) * 100) : 0;

    return {
      thisWeekPct: thisPct,
      lastWeekPct: lastPct,
      deltaPct: thisPct - lastPct,
      thisWeekBooked: thisBooked,
      thisWeekTotal: thisTotal,
    };
  }

  private async queryOpenIncompleteMatches(clubId: string) {
    const result = await this.db.query<{
      id: string;
      title: string;
      date: string;
      needed_players: number;
      joined_count: number;
    }>(
      `SELECT m.id,
              m.title,
              m.date,
              m.needed_players,
              (
                (SELECT COUNT(*)::int FROM match_players mp
                 WHERE mp.match_id = m.id AND mp.status IN ('JOINED','CONFIRMED'))
                +
                (SELECT COUNT(*)::int FROM match_guests mg WHERE mg.match_id = m.id)
              ) AS joined_count
       FROM matches m
       WHERE m.club_id = $1
         AND m.status = 'OPEN'
         AND m.date >= NOW()
         AND m.date <= NOW() + INTERVAL '7 days'
       ORDER BY m.date ASC
       LIMIT 40`,
      [clubId],
    );

    return result.rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        date: row.date,
        neededPlayers: row.needed_players,
        joinedCount: row.joined_count,
      }))
      .filter((m) => m.joinedCount < m.neededPlayers);
  }

  private async queryPendingDeposits(clubId: string) {
    const result = await this.db.query<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(md.amount), 0)::float8 AS total, COUNT(*)::int AS count
       FROM match_deposits md
       INNER JOIN matches m ON m.id = md.match_id
       WHERE m.club_id = $1 AND md.status = 'PENDING'`,
      [clubId],
    );
    return {
      amount: Number(result.rows[0]?.total ?? 0),
      count: result.rows[0]?.count ?? 0,
    };
  }

  private async queryActivePromotions(clubId: string) {
    const result = await this.db.query<{
      day_of_week: number | null;
      start_hour: number;
      end_hour: number;
    }>(
      `SELECT day_of_week, start_hour::float8 AS start_hour, end_hour::float8 AS end_hour
       FROM club_promotions
       WHERE club_id = $1 AND active = TRUE`,
      [clubId],
    );
    return result.rows;
  }

  private buildBriefing(input: {
    weekOccupancy: {
      thisWeekPct: number;
      lastWeekPct: number;
      deltaPct: number;
      thisWeekTotal: number;
    };
    atRiskCount: number;
    byCourt: Array<{ courtLabel: string; occupancyPct: number; totalSlots: number }>;
    autoFillGapsEnabled: boolean;
    valleys: Array<{
      dayOfWeek: number;
      hourBucket: number;
      occupancyPct: number;
      candidateCount: number;
    }>;
    activePromotions: Array<{
      day_of_week: number | null;
      start_hour: number;
      end_hour: number;
    }>;
    openMatches: Array<{ id: string; joinedCount: number; neededPlayers: number; date: string }>;
    pendingDeposits: { amount: number; count: number };
  }): BriefingCard[] {
    const cards: BriefingCard[] = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    if (input.pendingDeposits.count > 0) {
      cards.push({
        id: 'pending-deposits',
        severity: 'critical',
        title: `Tenés ${input.pendingDeposits.count} reservas sin seña`,
        body: `Hay aproximadamente ${Math.round(input.pendingDeposits.amount).toLocaleString('es-AR')} pendiente de cobro.`,
        actionLabel: 'Cobrar',
        action: { type: 'billing' },
      });
    }

    if (input.weekOccupancy.thisWeekTotal > 0) {
      const delta = input.weekOccupancy.deltaPct;
      const deltaText =
        delta === 0
          ? 'igual que la semana pasada'
          : delta > 0
            ? `${delta}% más que la semana pasada`
            : `${Math.abs(delta)}% menos que la semana pasada`;
      cards.push({
        id: 'week-occupancy',
        severity: delta < -5 ? 'warn' : delta > 5 ? 'success' : 'info',
        title: `Ocupación de esta semana: ${input.weekOccupancy.thisWeekPct}%`,
        body: `Proyectada sobre turnos publicados · ${deltaText}.`,
        actionLabel: 'Ver estadísticas',
        action: { type: 'court_slots', tab: 'stats' },
      });
    }

    if (input.atRiskCount > 0) {
      cards.push({
        id: 'at-risk',
        severity: 'opportunity',
        title: `${input.atRiskCount} clientes habituales en riesgo`,
        body: 'Hace más de 21 días que no reservan. Conviene contactarlos o invitarlos a un horario valle.',
        actionLabel: 'Ver clientes',
        action: { type: 'clients' },
      });
    }

    const courtsWithData = input.byCourt.filter((c) => c.totalSlots >= 5);
    if (courtsWithData.length >= 2) {
      const avg =
        courtsWithData.reduce((sum, c) => sum + c.occupancyPct, 0) /
        courtsWithData.length;
      const worst = [...courtsWithData].sort(
        (a, b) => a.occupancyPct - b.occupancyPct,
      )[0];
      if (worst && avg - worst.occupancyPct >= 15) {
        cards.push({
          id: 'weak-court',
          severity: 'warn',
          title: `${worst.courtLabel} tiene baja ocupación`,
          body: `Ocupación ${worst.occupancyPct}% vs ~${Math.round(avg)}% promedio del resto.`,
          actionLabel: 'Ver canchas',
          action: { type: 'court_slots', tab: 'courts' },
        });
      }
    }

    if (!input.autoFillGapsEnabled && input.valleys.length > 0) {
      cards.push({
        id: 'enable-auto-fill',
        severity: 'action',
        title: 'Activá el relleno automático de huecos',
        body: `Hay ${input.valleys.length} franjas valle detectadas. El motor puede avisar a jugadores habituales.`,
        actionLabel: 'Activar',
        action: { type: 'auto_fill' },
      });
    }

    const uncoveredValley = input.valleys.find((v) => {
      const overlaps = input.activePromotions.some((p) => {
        const dayOk = p.day_of_week == null || p.day_of_week === v.dayOfWeek;
        return dayOk && p.start_hour < v.hourBucket + 1 && p.end_hour > v.hourBucket;
      });
      return !overlaps && v.candidateCount > 0;
    });
    if (uncoveredValley) {
      cards.push({
        id: 'valley-promo',
        severity: 'warn',
        title: `Hoy hay horas muertas a las ${String(uncoveredValley.hourBucket).padStart(2, '0')} hs`,
        body: `Ocupación ~${uncoveredValley.occupancyPct}% el ${dayNames[uncoveredValley.dayOfWeek]} · ${uncoveredValley.candidateCount} candidatos.`,
        actionLabel: 'Enviar promoción',
        action: {
          type: 'court_slots',
          tab: 'promotions',
          dayOfWeek: uncoveredValley.dayOfWeek,
          hourBucket: uncoveredValley.hourBucket,
        },
      });
    }

    const consolidatable = this.countConsolidatablePairs(input.openMatches);
    if (consolidatable >= 1) {
      cards.push({
        id: 'consolidate-matches',
        severity: 'info',
        title: `${consolidatable} grupos de partidos podrían unificarse`,
        body: 'Hay partidos abiertos incompletos en franjas cercanas.',
        actionLabel: 'Ver reservas',
        action: { type: 'court_slots', tab: 'slots' },
      });
    }

    return cards.slice(0, 5);
  }

  private countConsolidatablePairs(
    matches: Array<{ joinedCount: number; neededPlayers: number; date: string }>,
  ): number {
    if (matches.length < 2) return 0;
    const sorted = [...matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    let pairs = 0;
    const used = new Set<number>();
    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;
        const diffMs = Math.abs(
          new Date(sorted[j].date).getTime() - new Date(sorted[i].date).getTime(),
        );
        if (diffMs > 2 * 60 * 60 * 1000) break;
        const combined = sorted[i].joinedCount + sorted[j].joinedCount;
        const need = Math.max(sorted[i].neededPlayers, sorted[j].neededPlayers);
        if (combined >= need && combined <= need + 2) {
          pairs += 1;
          used.add(i);
          used.add(j);
          break;
        }
      }
    }
    return pairs;
  }
}
