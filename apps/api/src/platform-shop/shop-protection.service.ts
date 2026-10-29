import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AdminResolveClaimDto,
  BuyerClaimDto,
  BuyerIdentityDto,
  BuyerReviewDto,
  PartnerClaimResponseDto,
  SponsorReportDto,
  UpdateSponsorTrustDto,
} from './dto/shop-protection.dto';
import { PlatformShopService } from './platform-shop.service';

/** Si el partner no avisa que recibió una transferencia en este plazo, se abre un reclamo solo. */
const MANUAL_PAYMENT_ACK_HOURS = 48;
/** Reclamos sin respuesta del partner pasado este plazo cuentan para la suspensión automática. */
const CLAIM_RESPONSE_HOURS = 72;
const CLAIM_WINDOW_DAYS = 60;

const OPEN_CLAIM_STATUSES = ['OPEN', 'PARTNER_RESPONDED'];
const DELIVERY_REASONS = ['NOT_RECEIVED', 'LATE_DELIVERY', 'PAYMENT_NOT_ACKNOWLEDGED'];

const REASON_LABELS: Record<string, string> = {
  NOT_RECEIVED: 'No recibí el pedido',
  LATE_DELIVERY: 'Venció el plazo de entrega',
  NOT_AS_DESCRIBED: 'El producto no es lo que compré',
  PAYMENT_NOT_ACKNOWLEDGED: 'Pagué y la tienda no lo confirma',
  NO_RESPONSE: 'La tienda no responde',
  SUSPECTED_SCAM: 'Sospecha de estafa',
  OTHER: 'Otro problema',
};

type OrderRow = {
  id: string;
  sponsor_id: string;
  user_id: string | null;
  status: string;
  payment_method: string | null;
  total: string;
  created_at: string;
  paid_at: string | null;
  buyer_reported_paid_at: string | null;
  delivery_deadline_at: string | null;
  fulfilled_at: string | null;
  received_at: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
};

type SponsorRow = {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  delivery_days: number;
  custom_domain?: string | null;
  custom_domain_status?: string;
  catalog_mode?: string | null;
  external_store_url?: string | null;
  website_url?: string | null;
};

function normalizeEmail(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

@Injectable()
export class ShopProtectionService {
  private readonly logger = new Logger(ShopProtectionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly shop: PlatformShopService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  private get suspendUnansweredClaims(): number {
    return Number(process.env.SHOP_SUSPEND_UNANSWERED_CLAIMS) || 2;
  }

  private get suspendLostClaims(): number {
    return Number(process.env.SHOP_SUSPEND_LOST_CLAIMS_90D) || 3;
  }

  // --- Lecturas ---

  private async loadOrder(orderId: string, sponsorId?: string): Promise<OrderRow> {
    const result = await this.db.query<OrderRow>(
      `SELECT o.id, o.sponsor_id, o.user_id, o.status, o.payment_method, o.total, o.created_at,
              o.paid_at, o.buyer_reported_paid_at, o.delivery_deadline_at, o.fulfilled_at,
              o.received_at,
              lower(COALESCE(o.guest_email, c.email, u.email)) AS buyer_email,
              COALESCE(o.guest_name, c.name, u.name) AS buyer_name
       FROM platform_orders o
       LEFT JOIN platform_sponsor_customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1 AND ($2::uuid IS NULL OR o.sponsor_id = $2::uuid)`,
      [orderId, sponsorId ?? null],
    );
    if (!result.rows[0]) throw new NotFoundException('Pedido no encontrado');
    return result.rows[0];
  }

  private async loadSponsor(sponsorId: string): Promise<SponsorRow> {
    const result = await this.db.query<SponsorRow>(
      `SELECT id, name, slug, contact_email, delivery_days, custom_domain, custom_domain_status,
              catalog_mode, external_store_url, website_url
       FROM platform_sponsors WHERE id = $1`,
      [sponsorId],
    );
    if (!result.rows[0]) throw new NotFoundException('Tienda no encontrada');
    return result.rows[0];
  }

  /** El link del pedido es el comprobante del comprador; además pedimos el email de la compra. */
  private async assertBuyer(slug: string, orderId: string, dto: BuyerIdentityDto) {
    const sponsor = await this.shop.getSponsorBySlug(slug);
    const order = await this.loadOrder(orderId, sponsor.id);
    if (!order.buyer_email || normalizeEmail(dto.email) !== order.buyer_email) {
      throw new ForbiddenException('El email no coincide con el de la compra');
    }
    return { sponsor: await this.loadSponsor(sponsor.id), order };
  }

  private orderUrl(sponsor: SponsorRow, orderId: string): string {
    return `${this.shop.storeUrl(sponsor)}/pedido/${orderId}`;
  }

  private partnerDashboardUrl(): string {
    const base = (
      process.env.WEB_SPONSORS_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SPONSORS_URL ||
      'http://localhost:3003'
    ).replace(/\/$/, '');
    return `${base}/dashboard/reclamos`;
  }

  async getOrderProtection(orderId: string) {
    const [order, claims, review] = await Promise.all([
      this.db.query<OrderRow>(
        `SELECT id, status, payment_method, created_at, paid_at, buyer_reported_paid_at,
                delivery_deadline_at, fulfilled_at, received_at, tracking_note
         FROM platform_orders WHERE id = $1`,
        [orderId],
      ),
      this.db.query(
        `SELECT id, reason, description, status, auto_created, partner_response,
                partner_responded_at, resolution_note, resolved_at, created_at
         FROM platform_shop_claims WHERE order_id = $1
         ORDER BY created_at DESC`,
        [orderId],
      ),
      this.db.query(
        `SELECT rating, comment, created_at FROM platform_sponsor_reviews WHERE order_id = $1`,
        [orderId],
      ),
    ]);
    const row = order.rows[0] as (OrderRow & { tracking_note?: string | null }) | undefined;
    if (!row) return null;
    const openClaim = claims.rows.find((c) => OPEN_CLAIM_STATUSES.includes(c.status)) ?? null;
    const isManual = row.payment_method === 'WHATSAPP';
    const withinWindow =
      Date.now() - new Date(row.created_at).getTime() < CLAIM_WINDOW_DAYS * 86_400_000;
    const paidOrReported =
      ['PAID', 'FULFILLED'].includes(row.status) ||
      (row.status === 'AWAITING_MANUAL_PAYMENT' && row.buyer_reported_paid_at != null);
    return {
      payment_protected: !isManual,
      paid_at: row.paid_at,
      buyer_reported_paid_at: row.buyer_reported_paid_at,
      delivery_deadline_at: row.delivery_deadline_at,
      fulfilled_at: row.fulfilled_at,
      tracking_note: row.tracking_note ?? null,
      received_at: row.received_at,
      claims: claims.rows.map((c) => ({ ...c, reason_label: REASON_LABELS[c.reason] ?? c.reason })),
      review: review.rows[0] ?? null,
      can_report_payment:
        isManual && row.status === 'AWAITING_MANUAL_PAYMENT' && !row.buyer_reported_paid_at,
      can_confirm_received: paidOrReported && !row.received_at && row.status !== 'CANCELLED',
      can_open_claim: !openClaim && withinWindow && (paidOrReported || row.status === 'CANCELLED'),
      can_review: Boolean(row.received_at || row.status === 'FULFILLED') && !review.rows[0],
    };
  }

  // --- Comprador ---

  async reportManualPayment(slug: string, orderId: string, dto: BuyerIdentityDto) {
    const { sponsor, order } = await this.assertBuyer(slug, orderId, dto);
    if (order.payment_method !== 'WHATSAPP' || order.status !== 'AWAITING_MANUAL_PAYMENT') {
      throw new BadRequestException('Este pedido no está esperando un pago manual');
    }
    if (order.buyer_reported_paid_at) return this.getOrderProtection(orderId);
    await this.db.query(
      `UPDATE platform_orders
       SET buyer_reported_paid_at = NOW(),
           delivery_deadline_at = NOW() + make_interval(days => $2::int),
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, sponsor.delivery_days],
    );
    await this.notifyPartner(sponsor, {
      type: 'SHOP_MANUAL_PAYMENT_REPORTED',
      title: `Pedido #${shortId(orderId)}: el comprador avisa que pagó`,
      body: `Verificá la transferencia y marcá el pedido como pagado. Si no lo confirmás en ${MANUAL_PAYMENT_ACK_HOURS} h se abre un reclamo.`,
      orderId,
    });
    return this.getOrderProtection(orderId);
  }

  async confirmReceived(slug: string, orderId: string, dto: BuyerIdentityDto) {
    const { sponsor, order } = await this.assertBuyer(slug, orderId, dto);
    if (order.received_at) return this.getOrderProtection(orderId);
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException('El pedido está cancelado');
    }
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE platform_orders
         SET received_at = NOW(),
             fulfilled_at = COALESCE(fulfilled_at, NOW()),
             paid_at = COALESCE(paid_at, NOW()),
             status = 'FULFILLED',
             updated_at = NOW()
         WHERE id = $1`,
        [orderId],
      );
      await client.query(
        `UPDATE platform_shop_claims
         SET status = 'RESOLVED_PARTNER',
             resolution_note = COALESCE(resolution_note, 'El comprador confirmó que recibió el pedido'),
             resolved_at = NOW(), updated_at = NOW()
         WHERE order_id = $1 AND status IN ('OPEN', 'PARTNER_RESPONDED')
           AND reason = ANY($2::shop_claim_reason[])`,
        [orderId, DELIVERY_REASONS],
      );
    });
    await this.notifyPartner(sponsor, {
      type: 'SHOP_ORDER_RECEIVED',
      title: `Pedido #${shortId(orderId)} entregado`,
      body: 'El comprador confirmó que recibió el pedido.',
      orderId,
      skipEmail: true,
    });
    return this.getOrderProtection(orderId);
  }

  async openClaim(slug: string, orderId: string, dto: BuyerClaimDto) {
    const { sponsor, order } = await this.assertBuyer(slug, orderId, dto);
    const protection = await this.getOrderProtection(orderId);
    if (!protection?.can_open_claim) {
      throw new BadRequestException(
        'No se puede abrir un reclamo para este pedido (ya hay uno abierto, no está pago o pasó el plazo)',
      );
    }
    await this.createClaim({
      sponsor,
      order,
      reason: dto.reason,
      description: dto.description.trim(),
      buyerEmail: order.buyer_email,
      autoCreated: false,
    });
    return this.getOrderProtection(orderId);
  }

  async withdrawClaim(slug: string, orderId: string, claimId: string, dto: BuyerIdentityDto) {
    const { sponsor } = await this.assertBuyer(slug, orderId, dto);
    const result = await this.db.query(
      `UPDATE platform_shop_claims
       SET status = 'WITHDRAWN', resolution_note = 'El comprador indicó que se solucionó',
           resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND order_id = $2 AND status IN ('OPEN', 'PARTNER_RESPONDED')
       RETURNING id`,
      [claimId, orderId],
    );
    if (!result.rows[0]) throw new NotFoundException('Reclamo no encontrado o ya cerrado');
    await this.notifyPartner(sponsor, {
      type: 'SHOP_CLAIM_WITHDRAWN',
      title: `Reclamo del pedido #${shortId(orderId)} cerrado`,
      body: 'El comprador indicó que el problema se solucionó.',
      orderId,
      skipEmail: true,
    });
    return this.getOrderProtection(orderId);
  }

  async createReview(slug: string, orderId: string, dto: BuyerReviewDto) {
    const { order } = await this.assertBuyer(slug, orderId, dto);
    const protection = await this.getOrderProtection(orderId);
    if (!protection?.can_review) {
      throw new BadRequestException('Podés calificar la tienda cuando recibas el pedido');
    }
    await this.db.query(
      `INSERT INTO platform_sponsor_reviews (sponsor_id, order_id, author_name, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO NOTHING`,
      [
        order.sponsor_id,
        orderId,
        order.buyer_name?.trim().split(/\s+/)[0] ?? null,
        dto.rating,
        dto.comment?.trim() || null,
      ],
    );
    return this.getOrderProtection(orderId);
  }

  async listPublicReviews(slug: string) {
    const sponsor = await this.shop.getSponsorBySlug(slug);
    const [summary, reviews] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1)::float8 AS average
         FROM platform_sponsor_reviews WHERE sponsor_id = $1`,
        [sponsor.id],
      ),
      this.db.query(
        `SELECT id, author_name, rating, comment, created_at
         FROM platform_sponsor_reviews WHERE sponsor_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [sponsor.id],
      ),
    ]);
    return { ...summary.rows[0], reviews: reviews.rows };
  }

  /** Reporte desde la app de una tienda (útil para catálogos externos, donde no hay pedido en x4). */
  async reportSponsor(userId: string, sponsorId: string, dto: SponsorReportDto) {
    const sponsor = await this.loadSponsor(sponsorId);
    const recent = await this.db.query(
      `SELECT 1 FROM platform_shop_claims
       WHERE sponsor_id = $1 AND user_id = $2 AND order_id IS NULL
         AND created_at > NOW() - INTERVAL '7 days'`,
      [sponsorId, userId],
    );
    if (recent.rows[0]) {
      throw new BadRequestException('Ya reportaste esta tienda en los últimos 7 días');
    }
    const user = await this.db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
      userId,
    ]);
    await this.createClaim({
      sponsor,
      order: null,
      userId,
      reason: dto.reason,
      description: dto.description.trim(),
      buyerEmail: normalizeEmail(user.rows[0]?.email) || null,
      autoCreated: false,
    });
    return { ok: true };
  }

  private async createClaim(params: {
    sponsor: SponsorRow;
    order: OrderRow | null;
    userId?: string | null;
    reason: string;
    description: string;
    buyerEmail: string | null;
    autoCreated: boolean;
  }) {
    const { sponsor, order } = params;
    let claimId: string | undefined;
    try {
      const inserted = await this.db.query<{ id: string }>(
        `INSERT INTO platform_shop_claims
           (sponsor_id, order_id, user_id, buyer_email, reason, description, auto_created)
         VALUES ($1, $2, $3, $4, $5::shop_claim_reason, $6, $7)
         RETURNING id`,
        [
          sponsor.id,
          order?.id ?? null,
          params.userId ?? order?.user_id ?? null,
          params.buyerEmail,
          params.reason,
          params.description,
          params.autoCreated,
        ],
      );
      claimId = inserted.rows[0]?.id;
    } catch (err: any) {
      if (err?.code === '23505') return null;
      throw err;
    }

    const label = REASON_LABELS[params.reason] ?? params.reason;
    const ref = order ? `pedido #${shortId(order.id)}` : 'tu tienda';
    await this.notifyPartner(sponsor, {
      type: 'SHOP_CLAIM_OPENED',
      title: `Nuevo reclamo en ${ref}`,
      body: `${label}. Respondé en menos de ${CLAIM_RESPONSE_HOURS} h: los reclamos sin respuesta pueden suspender la tienda.`,
      orderId: order?.id ?? null,
      claimId,
    });

    if (order && params.buyerEmail) {
      this.email.queueTemplate(params.buyerEmail, 'shopOrderNotice', {
        subject: `Abrimos un reclamo por tu pedido #${shortId(order.id)}`,
        title: 'Reclamo abierto',
        paragraphs: [
          `Registramos un reclamo por tu pedido en ${sponsor.name}: ${label}.`,
          `Le pedimos a la tienda que responda en menos de ${CLAIM_RESPONSE_HOURS} horas. Si no responde o no se soluciona, el equipo de x4 match interviene y la tienda puede ser suspendida.`,
        ],
        ctaLabel: 'Ver mi pedido',
        ctaUrl: this.orderUrl(sponsor, order.id),
      });
    }

    if (this.email.adminRecipients.length) {
      this.email.queueTemplate(this.email.adminRecipients, 'shopOrderNotice', {
        subject: `Reclamo Shop x4: ${sponsor.name} (${label})`,
        title: `Reclamo contra ${sponsor.name}`,
        paragraphs: [
          `Motivo: ${label}${params.autoCreated ? ' (abierto automáticamente)' : ''}.`,
          params.description,
          order ? `Pedido #${shortId(order.id)} · total $${order.total}` : 'Reporte desde la app, sin pedido en x4.',
        ],
      });
    }

    if (params.userId || order?.user_id) {
      await this.notifications.create({
        userId: (params.userId ?? order?.user_id)!,
        type: 'SHOP_CLAIM_UPDATE',
        title: 'Recibimos tu reclamo',
        body: `Le avisamos a ${sponsor.name}. Te contamos cuando responda.`,
        data: { sponsorId: sponsor.id, orderId: order?.id ?? null, claimId },
      });
    }
    return claimId ?? null;
  }

  // --- Partner ---

  async listPartnerClaims(sponsorId: string) {
    const result = await this.db.query(
      `SELECT cl.*, o.total, o.status AS order_status, o.payment_method, o.created_at AS order_created_at,
              COALESCE(o.guest_name, c.name, u.name, cu.name) AS buyer_name
       FROM platform_shop_claims cl
       LEFT JOIN platform_orders o ON o.id = cl.order_id
       LEFT JOIN platform_sponsor_customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN users cu ON cu.id = cl.user_id
       WHERE cl.sponsor_id = $1
       ORDER BY (cl.status IN ('OPEN', 'PARTNER_RESPONDED')) DESC, cl.created_at DESC
       LIMIT 200`,
      [sponsorId],
    );
    return result.rows.map((row) => ({
      ...row,
      reason_label: REASON_LABELS[row.reason] ?? row.reason,
      respond_before: new Date(
        new Date(row.created_at).getTime() + CLAIM_RESPONSE_HOURS * 3_600_000,
      ).toISOString(),
    }));
  }

  async respondClaim(sponsorId: string, claimId: string, dto: PartnerClaimResponseDto) {
    const result = await this.db.query<{ id: string; order_id: string | null; buyer_email: string | null; user_id: string | null }>(
      `UPDATE platform_shop_claims
       SET partner_response = $3,
           partner_responded_at = NOW(),
           status = 'PARTNER_RESPONDED',
           updated_at = NOW()
       WHERE id = $1 AND sponsor_id = $2 AND status IN ('OPEN', 'PARTNER_RESPONDED')
       RETURNING id, order_id, buyer_email, user_id`,
      [claimId, sponsorId, dto.message.trim()],
    );
    const claim = result.rows[0];
    if (!claim) throw new NotFoundException('Reclamo no encontrado o ya cerrado');
    const sponsor = await this.loadSponsor(sponsorId);
    if (claim.buyer_email) {
      this.email.queueTemplate(claim.buyer_email, 'shopOrderNotice', {
        subject: `${sponsor.name} respondió tu reclamo`,
        title: `${sponsor.name} respondió`,
        paragraphs: [dto.message.trim()],
        ctaLabel: claim.order_id ? 'Ver mi pedido' : undefined,
        ctaUrl: claim.order_id ? this.orderUrl(sponsor, claim.order_id) : undefined,
        note: 'Si se solucionó, cerrá el reclamo desde tu pedido. Si no, el equipo de x4 match lo revisa.',
      });
    }
    if (claim.user_id) {
      await this.notifications.create({
        userId: claim.user_id,
        type: 'SHOP_CLAIM_UPDATE',
        title: `${sponsor.name} respondió tu reclamo`,
        body: dto.message.trim().slice(0, 140),
        data: { sponsorId, orderId: claim.order_id, claimId },
      });
    }
    return { ok: true };
  }

  // --- Admin ---

  async listAllClaims(status?: string) {
    const result = await this.db.query(
      `SELECT cl.*, s.name AS sponsor_name, s.slug AS sponsor_slug, s.suspended_at,
              o.total, o.status AS order_status, o.payment_method
       FROM platform_shop_claims cl
       INNER JOIN platform_sponsors s ON s.id = cl.sponsor_id
       LEFT JOIN platform_orders o ON o.id = cl.order_id
       WHERE ($1::text IS NULL OR cl.status::text = $1)
       ORDER BY cl.created_at DESC
       LIMIT 300`,
      [status ?? null],
    );
    return result.rows.map((row) => ({ ...row, reason_label: REASON_LABELS[row.reason] ?? row.reason }));
  }

  async resolveClaim(claimId: string, dto: AdminResolveClaimDto) {
    const result = await this.db.query<{ sponsor_id: string; order_id: string | null; buyer_email: string | null }>(
      `UPDATE platform_shop_claims
       SET status = $2::shop_claim_status, resolution_note = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING sponsor_id, order_id, buyer_email`,
      [claimId, dto.status, dto.resolutionNote?.trim() || null],
    );
    const claim = result.rows[0];
    if (!claim) throw new NotFoundException('Reclamo no encontrado');
    const sponsor = await this.loadSponsor(claim.sponsor_id);
    if (claim.buyer_email) {
      this.email.queueTemplate(claim.buyer_email, 'shopOrderNotice', {
        subject: `Resolvimos tu reclamo con ${sponsor.name}`,
        title: 'Reclamo resuelto',
        paragraphs: [
          dto.status === 'RESOLVED_BUYER'
            ? `Revisamos el caso y le dimos la razón al comprador. ${sponsor.name} debe devolverte el dinero o enviarte el pedido.`
            : 'Revisamos el caso y la tienda demostró que cumplió con el pedido.',
          ...(dto.resolutionNote?.trim() ? [dto.resolutionNote.trim()] : []),
        ],
      });
    }
    await this.notifyPartner(sponsor, {
      type: 'SHOP_CLAIM_RESOLVED',
      title: 'x4 match resolvió un reclamo',
      body:
        dto.status === 'RESOLVED_BUYER'
          ? 'Se resolvió a favor del comprador. Devolvé el dinero o enviá el pedido.'
          : 'Se resolvió a favor de tu tienda.',
      orderId: claim.order_id,
      claimId,
    });
    await this.enforceSuspension(claim.sponsor_id);
    return { ok: true };
  }

  async updateTrust(sponsorId: string, dto: UpdateSponsorTrustDto) {
    const result = await this.db.query(
      `UPDATE platform_sponsors
       SET verified = COALESCE($2, verified),
           verified_at = CASE WHEN $2 = TRUE AND verified = FALSE THEN NOW()
                              WHEN $2 = FALSE THEN NULL ELSE verified_at END,
           suspended_at = CASE WHEN $3 = TRUE THEN COALESCE(suspended_at, NOW())
                               WHEN $3 = FALSE THEN NULL ELSE suspended_at END,
           suspension_reason = CASE WHEN $3 = TRUE THEN COALESCE($4, suspension_reason)
                                    WHEN $3 = FALSE THEN NULL ELSE suspension_reason END,
           delivery_days = COALESCE($5, delivery_days),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, verified, verified_at, suspended_at, suspension_reason, delivery_days`,
      [
        sponsorId,
        dto.verified ?? null,
        dto.suspended ?? null,
        dto.suspensionReason?.trim() || null,
        dto.deliveryDays ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException('Partner no encontrado');
    return result.rows[0];
  }

  // --- Automático ---

  @Cron(CronExpression.EVERY_HOUR)
  async runAutomations() {
    try {
      const late = await this.openOverdueClaims();
      const suspended = await this.enforceSuspensionForAll();
      if (late || suspended) {
        this.logger.log(`Shop x4: reclamos automáticos=${late} tiendas suspendidas=${suspended}`);
      }
    } catch (error) {
      this.logger.warn(`Shop x4 automatizaciones fallaron: ${(error as Error).message}`);
    }
  }

  private async openOverdueClaims(): Promise<number> {
    const overdue = await this.db.query<{ id: string; reason: string }>(
      `SELECT o.id,
              CASE WHEN o.status = 'AWAITING_MANUAL_PAYMENT' THEN 'PAYMENT_NOT_ACKNOWLEDGED'
                   ELSE 'LATE_DELIVERY' END AS reason
       FROM platform_orders o
       WHERE o.received_at IS NULL
         AND o.fulfilled_at IS NULL
         AND (
           (o.status = 'PAID' AND o.delivery_deadline_at < NOW())
           OR (o.status = 'AWAITING_MANUAL_PAYMENT'
               AND o.buyer_reported_paid_at < NOW() - make_interval(hours => $1::int))
         )
         AND NOT EXISTS (SELECT 1 FROM platform_shop_claims cl WHERE cl.order_id = o.id)
       LIMIT 200`,
      [MANUAL_PAYMENT_ACK_HOURS],
    );
    let created = 0;
    for (const row of overdue.rows) {
      const order = await this.loadOrder(row.id);
      const sponsor = await this.loadSponsor(order.sponsor_id);
      const description =
        row.reason === 'PAYMENT_NOT_ACKNOWLEDGED'
          ? `El comprador avisó que transfirió hace más de ${MANUAL_PAYMENT_ACK_HOURS} h y la tienda no confirmó el pago.`
          : 'Venció el plazo de entrega y la tienda no marcó el pedido como enviado.';
      const id = await this.createClaim({
        sponsor,
        order,
        reason: row.reason,
        description,
        buyerEmail: order.buyer_email,
        autoCreated: true,
      });
      if (id) created += 1;
    }
    return created;
  }

  private async enforceSuspensionForAll(): Promise<number> {
    const candidates = await this.db.query<{ id: string }>(
      `SELECT DISTINCT sponsor_id AS id FROM platform_shop_claims
       WHERE status IN ('OPEN', 'RESOLVED_BUYER')
         AND sponsor_id IN (SELECT id FROM platform_sponsors WHERE suspended_at IS NULL)`,
    );
    let suspended = 0;
    for (const row of candidates.rows) {
      if (await this.enforceSuspension(row.id)) suspended += 1;
    }
    return suspended;
  }

  /** Suspende (oculta del Shop y bloquea el checkout) si acumula reclamos sin respuesta o perdidos. */
  private async enforceSuspension(sponsorId: string): Promise<boolean> {
    const stats = await this.db.query<{ unanswered: number; lost: number; suspended: boolean }>(
      `SELECT
         (SELECT COUNT(*)::int FROM platform_shop_claims
           WHERE sponsor_id = $1 AND status = 'OPEN'
             AND created_at < NOW() - make_interval(hours => $2::int)) AS unanswered,
         (SELECT COUNT(*)::int FROM platform_shop_claims
           WHERE sponsor_id = $1 AND status = 'RESOLVED_BUYER'
             AND resolved_at > NOW() - INTERVAL '90 days') AS lost,
         (SELECT suspended_at IS NOT NULL FROM platform_sponsors WHERE id = $1) AS suspended`,
      [sponsorId, CLAIM_RESPONSE_HOURS],
    );
    const row = stats.rows[0];
    if (!row || row.suspended) return false;
    let reason: string | null = null;
    if (row.unanswered >= this.suspendUnansweredClaims) {
      reason = `${row.unanswered} reclamos sin responder en más de ${CLAIM_RESPONSE_HOURS} h`;
    } else if (row.lost >= this.suspendLostClaims) {
      reason = `${row.lost} reclamos resueltos a favor del comprador en 90 días`;
    }
    if (!reason) return false;

    await this.db.query(
      `UPDATE platform_sponsors
       SET suspended_at = NOW(), suspension_reason = $2, updated_at = NOW()
       WHERE id = $1 AND suspended_at IS NULL`,
      [sponsorId, `Suspensión automática: ${reason}`],
    );
    const sponsor = await this.loadSponsor(sponsorId);
    await this.notifyPartner(sponsor, {
      type: 'SHOP_SPONSOR_SUSPENDED',
      title: 'Tu tienda fue suspendida en Shop x4',
      body: `Motivo: ${reason}. Respondé los reclamos y escribinos a soporte@x4match.com para reactivarla.`,
    });
    if (this.email.adminRecipients.length) {
      this.email.queueTemplate(this.email.adminRecipients, 'shopOrderNotice', {
        subject: `Shop x4: ${sponsor.name} suspendida automáticamente`,
        title: `${sponsor.name} suspendida`,
        paragraphs: [`Motivo: ${reason}.`],
      });
    }
    return true;
  }

  private async notifyPartner(
    sponsor: SponsorRow,
    params: {
      type: string;
      title: string;
      body: string;
      orderId?: string | null;
      claimId?: string;
      skipEmail?: boolean;
    },
  ) {
    const members = await this.db.query<{ user_id: string; email: string }>(
      `SELECT m.user_id, u.email
       FROM platform_sponsor_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.sponsor_id = $1`,
      [sponsor.id],
    );
    if (members.rows.length) {
      await this.notifications.createMany(
        members.rows.map((m) => ({
          userId: m.user_id,
          type: params.type,
          title: params.title,
          body: params.body,
          data: { sponsorId: sponsor.id, orderId: params.orderId ?? null, claimId: params.claimId ?? null },
        })),
      );
    }
    if (params.skipEmail) return;
    const recipients = [
      ...new Set(
        [sponsor.contact_email, ...members.rows.map((m) => m.email)]
          .map(normalizeEmail)
          .filter(Boolean),
      ),
    ];
    if (recipients.length) {
      this.email.queueTemplate(recipients, 'shopOrderNotice', {
        subject: params.title,
        title: params.title,
        paragraphs: [params.body],
        ctaLabel: 'Ir a reclamos',
        ctaUrl: this.partnerDashboardUrl(),
      });
    }
  }
}
