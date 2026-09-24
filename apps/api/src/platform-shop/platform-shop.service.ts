import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import {
  AddSponsorMemberDto,
  CreateCategoryDto,
  CreateCouponDto,
  CreatePlatformProductDto,
  CreatePlatformSponsorDto,
  CreateShippingMethodDto,
  SetSponsorDomainDto,
  ShippingQuoteDto,
  SponsorCheckoutDto,
  SponsorCustomerAuthDto,
  UpdateCategoryDto,
  UpdateOrderStatusDto,
  UpdatePlatformProductDto,
  UpdatePlatformSponsorDto,
  UpdateShippingMethodDto,
} from './dto/platform-shop.dto';
import { SponsorPaymentsService } from './sponsor-payments.service';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'sponsor';
}

@Injectable()
export class PlatformShopService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly payments: SponsorPaymentsService,
  ) {}

  private sponsorsPublicBase(): string {
    return (
      process.env.WEB_SPONSORS_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SPONSORS_URL ||
      'http://localhost:3003'
    ).replace(/\/$/, '');
  }

  private sponsorsHost(): string {
    return (
      process.env.WEB_SPONSORS_HOST ||
      process.env.NEXT_PUBLIC_SPONSORS_HOST ||
      'sponsor.x4match.com'
    )
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
  }

  productUrl(sponsor: { slug: string; custom_domain?: string | null; custom_domain_status?: string }, productId: string) {
    if (sponsor.custom_domain && sponsor.custom_domain_status === 'ACTIVE') {
      return `https://${sponsor.custom_domain}/productos/${productId}`;
    }
    return `${this.sponsorsPublicBase()}/${sponsor.slug}/productos/${productId}`;
  }

  storeUrl(sponsor: { slug: string; custom_domain?: string | null; custom_domain_status?: string }) {
    if (sponsor.custom_domain && sponsor.custom_domain_status === 'ACTIVE') {
      return `https://${sponsor.custom_domain}`;
    }
    return `${this.sponsorsPublicBase()}/${sponsor.slug}`;
  }

  async listActiveProducts() {
    const result = await this.db.query(
      `SELECT p.id, p.name, p.description, p.price, p.compare_at_price, p.currency, p.photo_url,
              p.stock_quantity, p.category, p.sort_order, p.status, p.is_new, p.featured,
              s.id AS sponsor_id, s.name AS sponsor_name, s.logo_url AS sponsor_logo_url,
              s.slug AS sponsor_slug, s.custom_domain, s.custom_domain_status
       FROM platform_products p
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       WHERE p.status = 'ACTIVE' AND (s.active IS NULL OR s.active = TRUE)
       ORDER BY p.sort_order ASC, p.name ASC`,
    );
    return result.rows.map((row) => ({
      ...row,
      product_url: row.sponsor_slug
        ? this.productUrl(row, row.id)
        : null,
    }));
  }

  async getProduct(productId: string) {
    const result = await this.db.query(
      `SELECT p.*, s.name AS sponsor_name, s.logo_url AS sponsor_logo_url,
              s.website_url AS sponsor_website_url, s.slug AS sponsor_slug,
              s.custom_domain, s.custom_domain_status
       FROM platform_products p
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       WHERE p.id = $1`,
      [productId],
    );
    if (!result.rows[0]) throw new NotFoundException('Producto no encontrado');
    const row = result.rows[0];
    return {
      ...row,
      product_url: row.sponsor_slug ? this.productUrl(row, row.id) : null,
    };
  }

  /** @deprecated in-app checkout — kept for backward compatibility */
  async createOrder(userId: string, dto: { productId: string; quantity?: number; shippingNote?: string }) {
    const product = await this.getProduct(dto.productId);
    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('El producto no está disponible');
    }
    const quantity = dto.quantity ?? 1;
    if (product.stock_quantity != null && Number(product.stock_quantity) < quantity) {
      throw new BadRequestException('Sin stock suficiente');
    }
    const unitPrice = Number(product.price);
    const subtotal = unitPrice * quantity;
    const order = await this.db.query(
      `INSERT INTO platform_orders
         (user_id, sponsor_id, status, total, currency, payment_status, shipping_note)
       VALUES ($1, $2, 'PENDING', $3, $4, 'PENDING', $5)
       RETURNING *`,
      [
        userId,
        product.sponsor_id ?? null,
        subtotal,
        product.currency || 'ARS',
        dto.shippingNote?.trim() || null,
      ],
    );
    await this.db.query(
      `INSERT INTO platform_order_items
         (order_id, product_id, quantity, unit_price, subtotal)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.rows[0].id, product.id, quantity, unitPrice, subtotal],
    );
    if (product.stock_quantity != null) {
      await this.db.query(
        `UPDATE platform_products
         SET stock_quantity = GREATEST(0, stock_quantity - $2), updated_at = NOW()
         WHERE id = $1`,
        [product.id, quantity],
      );
    }
    return this.getOrderForUser(order.rows[0].id, userId);
  }

  async listMyOrders(userId: string) {
    const orders = await this.db.query(
      `SELECT * FROM platform_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    if (!orders.rows.length) return [];
    const items = await this.db.query(
      `SELECT oi.*, p.name AS product_name, p.photo_url, s.name AS sponsor_name
       FROM platform_order_items oi
       INNER JOIN platform_products p ON p.id = oi.product_id
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       WHERE oi.order_id = ANY($1::uuid[])
       ORDER BY oi.id ASC`,
      [orders.rows.map((o) => o.id)],
    );
    const byOrder = new Map<string, any[]>();
    for (const item of items.rows) {
      const list = byOrder.get(item.order_id) || [];
      list.push(item);
      byOrder.set(item.order_id, list);
    }
    return orders.rows.map((o) => ({ ...o, items: byOrder.get(o.id) || [] }));
  }

  async getOrderForUser(orderId: string, userId: string) {
    const order = await this.db.query(
      `SELECT * FROM platform_orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId],
    );
    if (!order.rows[0]) throw new NotFoundException('Pedido no encontrado');
    const items = await this.db.query(
      `SELECT oi.*, p.name AS product_name, p.photo_url, s.name AS sponsor_name
       FROM platform_order_items oi
       INNER JOIN platform_products p ON p.id = oi.product_id
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       WHERE oi.order_id = $1`,
      [orderId],
    );
    return { ...order.rows[0], items: items.rows };
  }

  async simulatePay(orderId: string, userId: string) {
    const order = await this.getOrderForUser(orderId, userId);
    if (order.status !== 'PENDING') {
      throw new BadRequestException('El pedido no está pendiente de pago');
    }
    const result = await this.db.query(
      `UPDATE platform_orders
       SET status = 'PAID',
           payment_status = 'APPROVED',
           payment_provider = 'MANUAL',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId],
    );
    return { ...result.rows[0], items: order.items };
  }

  // --- Resolve / public store ---

  async resolveByHost(host: string) {
    const normalized = host.toLowerCase().split(':')[0].replace(/^www\./, '');
    const platformHost = this.sponsorsHost().toLowerCase();
    if (normalized === platformHost || normalized === 'localhost' || normalized.endsWith('.localhost')) {
      return { mode: 'platform' as const, host: normalized };
    }
    const result = await this.db.query(
      `SELECT id, slug, name FROM platform_sponsors
       WHERE custom_domain = $1 AND custom_domain_status = 'ACTIVE' AND active = TRUE`,
      [normalized],
    );
    if (!result.rows[0]) throw new NotFoundException('Dominio no asociado a un partner');
    return { mode: 'custom' as const, host: normalized, sponsor: result.rows[0] };
  }

  async getSponsorBySlug(slug: string) {
    if (['me', 'oauth', 'webhooks', 'resolve'].includes(slug)) {
      throw new NotFoundException('Tienda no encontrada');
    }
    const result = await this.db.query(
      `SELECT * FROM platform_sponsors WHERE slug = $1 AND active = TRUE`,
      [slug],
    );
    if (!result.rows[0]) throw new NotFoundException('Tienda no encontrada');
    const sponsor = result.rows[0];
    const pay = await this.payments.getPublicPaymentOptions(sponsor.id);
    return {
      ...sponsor,
      store_url: this.storeUrl(sponsor),
      payment_options: pay,
    };
  }

  async listCategories(slug: string, activeOnly = true) {
    const sponsor = await this.getSponsorBySlug(slug);
    const result = await this.db.query(
      `SELECT * FROM platform_sponsor_categories
       WHERE sponsor_id = $1 ${activeOnly ? 'AND active = TRUE' : ''}
       ORDER BY sort_order ASC, name ASC`,
      [sponsor.id],
    );
    return result.rows;
  }

  async listStoreProducts(
    slug: string,
    opts: { category?: string; offers?: boolean } = {},
  ) {
    const sponsor = await this.getSponsorBySlug(slug);
    const values: any[] = [sponsor.id];
    const filters = [`p.sponsor_id = $1`, `p.status = 'ACTIVE'`];
    if (opts.category) {
      values.push(opts.category);
      filters.push(`(c.slug = $${values.length} OR p.category = $${values.length})`);
    }
    if (opts.offers) {
      filters.push(`(p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price OR p.featured = TRUE)`);
    }
    const result = await this.db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM platform_products p
       LEFT JOIN platform_sponsor_categories c ON c.id = p.category_id
       WHERE ${filters.join(' AND ')}
       ORDER BY p.sort_order ASC, p.name ASC`,
      values,
    );
    return result.rows.map((row) => ({
      ...row,
      product_url: this.productUrl(sponsor, row.id),
      discount_percent:
        row.compare_at_price && Number(row.compare_at_price) > Number(row.price)
          ? Math.round(
              ((Number(row.compare_at_price) - Number(row.price)) / Number(row.compare_at_price)) *
                100,
            )
          : null,
    }));
  }

  async getStoreProduct(slug: string, productId: string) {
    const sponsor = await this.getSponsorBySlug(slug);
    const result = await this.db.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM platform_products p
       LEFT JOIN platform_sponsor_categories c ON c.id = p.category_id
       WHERE p.id = $1 AND p.sponsor_id = $2 AND p.status = 'ACTIVE'`,
      [productId, sponsor.id],
    );
    if (!result.rows[0]) throw new NotFoundException('Producto no encontrado');
    return {
      ...result.rows[0],
      product_url: this.productUrl(sponsor, productId),
      sponsor: {
        id: sponsor.id,
        name: sponsor.name,
        slug: sponsor.slug,
        logo_url: sponsor.logo_url,
        primary_color: sponsor.primary_color,
        contact_whatsapp: sponsor.contact_whatsapp,
      },
    };
  }

  async quoteShipping(slug: string, dto: ShippingQuoteDto) {
    const sponsor = await this.getSponsorBySlug(slug);
    const result = await this.db.query(
      `SELECT * FROM platform_sponsor_shipping_methods
       WHERE sponsor_id = $1 AND active = TRUE
       ORDER BY sort_order ASC`,
      [sponsor.id],
    );
    const subtotal = Number(dto.subtotal);
    const methods = result.rows
      .filter((m) => {
        if (m.type === 'FREE_OVER') {
          return subtotal >= Number(m.min_order ?? m.price ?? 0);
        }
        if (m.min_order != null && subtotal < Number(m.min_order)) return false;
        return true;
      })
      .map((m) => {
        let cost = Number(m.price);
        if (m.type === 'PICKUP') cost = 0;
        if (m.type === 'FREE_OVER') cost = 0;
        if (
          sponsor.free_shipping_threshold != null &&
          subtotal >= Number(sponsor.free_shipping_threshold)
        ) {
          cost = 0;
        }
        return {
          id: m.id,
          name: m.name,
          type: m.type,
          price: cost,
          postalCode: dto.postalCode,
        };
      });
    return {
      methods,
      freeShippingThreshold: sponsor.free_shipping_threshold
        ? Number(sponsor.free_shipping_threshold)
        : null,
      freeShippingRemaining:
        sponsor.free_shipping_threshold != null
          ? Math.max(0, Number(sponsor.free_shipping_threshold) - subtotal)
          : null,
    };
  }

  async checkout(slug: string, dto: SponsorCheckoutDto, customerId?: string) {
    const sponsor = await this.getSponsorBySlug(slug);
    const pay = await this.payments.getPublicPaymentOptions(sponsor.id);
    if (dto.paymentMethod === 'MERCADOPAGO' && !pay.mpEnabled) {
      throw new BadRequestException('Mercado Pago no está habilitado en esta tienda');
    }
    if (dto.paymentMethod === 'WHATSAPP' && !pay.whatsappEnabled) {
      throw new BadRequestException('WhatsApp no está habilitado en esta tienda');
    }
    if (!dto.items?.length) throw new BadRequestException('El carrito está vacío');

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.db.query(
      `SELECT * FROM platform_products
       WHERE sponsor_id = $1 AND id = ANY($2::uuid[]) AND status = 'ACTIVE'`,
      [sponsor.id, productIds],
    );
    if (products.rows.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no están disponibles');
    }
    const byId = new Map(products.rows.map((p) => [p.id, p]));

    let subtotal = 0;
    const lineItems: Array<{ product: any; quantity: number; unit: number; line: number }> = [];
    for (const item of dto.items) {
      const product = byId.get(item.productId);
      if (!product) throw new BadRequestException('Producto inválido');
      if (product.stock_quantity != null && Number(product.stock_quantity) < item.quantity) {
        throw new BadRequestException(`Sin stock suficiente: ${product.name}`);
      }
      const unit = Number(product.price);
      const line = unit * item.quantity;
      subtotal += line;
      lineItems.push({ product, quantity: item.quantity, unit, line });
    }

    let discountTotal = 0;
    let couponId: string | null = null;
    if (dto.couponCode?.trim()) {
      const coupon = await this.db.query(
        `SELECT * FROM platform_sponsor_coupons
         WHERE sponsor_id = $1 AND upper(code) = upper($2) AND active = TRUE`,
        [sponsor.id, dto.couponCode.trim()],
      );
      const c = coupon.rows[0];
      if (!c) throw new BadRequestException('Cupón inválido');
      if (c.expires_at && new Date(c.expires_at) < new Date()) {
        throw new BadRequestException('Cupón expirado');
      }
      if (c.max_uses != null && Number(c.uses_count) >= Number(c.max_uses)) {
        throw new BadRequestException('Cupón agotado');
      }
      if (c.discount_percent != null) {
        discountTotal = (subtotal * Number(c.discount_percent)) / 100;
      } else if (c.discount_amount != null) {
        discountTotal = Number(c.discount_amount);
      }
      discountTotal = Math.min(discountTotal, subtotal);
      couponId = c.id;
    }

    let shippingCost = 0;
    let shippingMethodId: string | null = dto.shippingMethodId ?? null;
    if (shippingMethodId) {
      const quote = await this.quoteShipping(slug, {
        postalCode: dto.shippingPostalCode || '',
        subtotal: subtotal - discountTotal,
      });
      const method = quote.methods.find((m) => m.id === shippingMethodId);
      if (!method) throw new BadRequestException('Método de envío no disponible');
      shippingCost = method.price;
    }

    const total = Math.max(0, subtotal - discountTotal + shippingCost);
    const guestName = dto.guestName?.trim() || null;
    const guestEmail = dto.guestEmail?.trim()?.toLowerCase() || null;
    const guestPhone = dto.guestPhone?.trim() || null;
    if (!customerId && (!guestEmail || !guestName)) {
      throw new BadRequestException('Nombre y email son obligatorios');
    }

    const status =
      dto.paymentMethod === 'WHATSAPP' ? 'AWAITING_MANUAL_PAYMENT' : 'PENDING';

    const order = await this.db.query(
      `INSERT INTO platform_orders
         (sponsor_id, customer_id, guest_name, guest_email, guest_phone,
          status, total, currency, payment_status, payment_method,
          coupon_id, discount_total, shipping_method_id, shipping_cost,
          shipping_postal_code, shipping_address)
       VALUES ($1,$2,$3,$4,$5,$6::platform_order_status,$7,'ARS','PENDING',$8::sponsor_payment_method,
               $9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        sponsor.id,
        customerId ?? null,
        guestName,
        guestEmail,
        guestPhone,
        status,
        total,
        dto.paymentMethod,
        couponId,
        discountTotal,
        shippingMethodId,
        shippingCost,
        dto.shippingPostalCode?.trim() || null,
        dto.shippingAddress?.trim() || null,
      ],
    );

    for (const line of lineItems) {
      await this.db.query(
        `INSERT INTO platform_order_items
           (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.rows[0].id, line.product.id, line.quantity, line.unit, line.line],
      );
      if (line.product.stock_quantity != null) {
        await this.db.query(
          `UPDATE platform_products
           SET stock_quantity = GREATEST(0, stock_quantity - $2), updated_at = NOW()
           WHERE id = $1`,
          [line.product.id, line.quantity],
        );
      }
    }

    if (couponId) {
      await this.db.query(
        `UPDATE platform_sponsor_coupons SET uses_count = uses_count + 1 WHERE id = $1`,
        [couponId],
      );
    }

    const created = await this.getStoreOrder(slug, order.rows[0].id);

    if (dto.paymentMethod === 'MERCADOPAGO') {
      const checkout = await this.payments.createMercadoPagoCheckout(sponsor, created);
      return { ...created, checkoutUrl: checkout.checkoutUrl, whatsappUrl: null };
    }

    const whatsappUrl = this.payments.buildWhatsappOrderUrl(sponsor, created, pay.whatsappPhone!);
    return { ...created, checkoutUrl: null, whatsappUrl };
  }

  async getStoreOrder(slug: string, orderId: string) {
    const sponsor = await this.getSponsorBySlug(slug);
    const order = await this.db.query(
      `SELECT * FROM platform_orders WHERE id = $1 AND sponsor_id = $2`,
      [orderId, sponsor.id],
    );
    if (!order.rows[0]) throw new NotFoundException('Pedido no encontrado');
    const items = await this.db.query(
      `SELECT oi.*, p.name AS product_name, p.photo_url
       FROM platform_order_items oi
       INNER JOIN platform_products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId],
    );
    return { ...order.rows[0], items: items.rows, store_url: this.storeUrl(sponsor) };
  }

  async registerCustomer(slug: string, dto: SponsorCustomerAuthDto) {
    const sponsor = await this.getSponsorBySlug(slug);
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }
    if (!dto.name?.trim()) throw new BadRequestException('Nombre requerido');
    const hash = await bcrypt.hash(dto.password, 10);
    try {
      const result = await this.db.query(
        `INSERT INTO platform_sponsor_customers
           (sponsor_id, email, password_hash, name, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, sponsor_id, email, name, phone, created_at`,
        [
          sponsor.id,
          dto.email.trim().toLowerCase(),
          hash,
          dto.name.trim(),
          dto.phone?.trim() || null,
        ],
      );
      const customer = result.rows[0];
      const token = await this.jwt.signAsync({
        sub: customer.id,
        typ: 'sponsor_customer',
        sponsorId: sponsor.id,
        email: customer.email,
      });
      return { customer, token };
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Ya existe una cuenta con ese email');
      }
      throw err;
    }
  }

  async loginCustomer(slug: string, dto: SponsorCustomerAuthDto) {
    const sponsor = await this.getSponsorBySlug(slug);
    const result = await this.db.query(
      `SELECT * FROM platform_sponsor_customers
       WHERE sponsor_id = $1 AND email = $2`,
      [sponsor.id, dto.email.trim().toLowerCase()],
    );
    const customer = result.rows[0];
    if (!customer) throw new BadRequestException('Credenciales inválidas');
    const ok = await bcrypt.compare(dto.password, customer.password_hash);
    if (!ok) throw new BadRequestException('Credenciales inválidas');
    const token = await this.jwt.signAsync({
      sub: customer.id,
      typ: 'sponsor_customer',
      sponsorId: sponsor.id,
      email: customer.email,
    });
    return {
      customer: {
        id: customer.id,
        sponsor_id: customer.sponsor_id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      },
      token,
    };
  }

  async listCustomerOrders(slug: string, customerId: string) {
    const sponsor = await this.getSponsorBySlug(slug);
    const orders = await this.db.query(
      `SELECT * FROM platform_orders
       WHERE sponsor_id = $1 AND customer_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [sponsor.id, customerId],
    );
    return orders.rows;
  }

  // --- Partner membership ---

  async assertMember(userId: string, sponsorId: string) {
    const result = await this.db.query(
      `SELECT m.*, u.role AS user_role
       FROM platform_sponsor_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.user_id = $1 AND m.sponsor_id = $2`,
      [userId, sponsorId],
    );
    const user = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (user.rows[0]?.role === 'SUPER_ADMIN') {
      return { role: 'OWNER', user_id: userId, sponsor_id: sponsorId };
    }
    if (!result.rows[0]) throw new ForbiddenException('No tenés acceso a este partner');
    return result.rows[0];
  }

  async listMySponsors(userId: string) {
    const user = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (user.rows[0]?.role === 'SUPER_ADMIN') {
      return this.listSponsors();
    }
    const result = await this.db.query(
      `SELECT s.*, m.role AS member_role
       FROM platform_sponsor_members m
       INNER JOIN platform_sponsors s ON s.id = m.sponsor_id
       WHERE m.user_id = $1
       ORDER BY s.name ASC`,
      [userId],
    );
    return result.rows;
  }

  async getMySponsor(userId: string, sponsorId: string) {
    await this.assertMember(userId, sponsorId);
    const result = await this.db.query(`SELECT * FROM platform_sponsors WHERE id = $1`, [
      sponsorId,
    ]);
    if (!result.rows[0]) throw new NotFoundException('Partner no encontrado');
    return {
      ...result.rows[0],
      store_url: this.storeUrl(result.rows[0]),
      platform_host: this.sponsorsHost(),
    };
  }

  async updateMySponsor(userId: string, sponsorId: string, dto: UpdatePlatformSponsorDto) {
    await this.assertMember(userId, sponsorId);
    return this.updateSponsor(sponsorId, dto);
  }

  // --- Admin / ops ---

  async listAllProducts() {
    const result = await this.db.query(
      `SELECT p.*, s.name AS sponsor_name, s.slug AS sponsor_slug
       FROM platform_products p
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       ORDER BY p.sort_order ASC, p.created_at DESC`,
    );
    return result.rows;
  }

  async listSponsors() {
    const result = await this.db.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM platform_products p WHERE p.sponsor_id = s.id) AS products_count,
              pc.mp_status, pc.mp_enabled, pc.whatsapp_enabled
       FROM platform_sponsors s
       LEFT JOIN platform_sponsor_payment_config pc ON pc.sponsor_id = s.id
       ORDER BY s.name ASC`,
    );
    return result.rows.map((row) => ({
      ...row,
      store_url: this.storeUrl(row),
    }));
  }

  async createSponsor(dto: CreatePlatformSponsorDto) {
    let slug = slugify(dto.slug || dto.name);
    const exists = await this.db.query(`SELECT id FROM platform_sponsors WHERE slug = $1`, [slug]);
    if (exists.rows[0]) {
      slug = `${slug}-${randomBytes(2).toString('hex')}`;
    }
    const result = await this.db.query(
      `INSERT INTO platform_sponsors (name, slug, logo_url, website_url, active)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
       RETURNING *`,
      [dto.name.trim(), slug, dto.logoUrl ?? null, dto.websiteUrl ?? null, dto.active ?? true],
    );
    await this.db.query(
      `INSERT INTO platform_sponsor_payment_config (sponsor_id)
       VALUES ($1) ON CONFLICT DO NOTHING`,
      [result.rows[0].id],
    );
    return { ...result.rows[0], store_url: this.storeUrl(result.rows[0]) };
  }

  async updateSponsor(sponsorId: string, dto: UpdatePlatformSponsorDto) {
    let slug: string | null = null;
    if (dto.slug) {
      slug = slugify(dto.slug);
      const clash = await this.db.query(
        `SELECT id FROM platform_sponsors WHERE slug = $1 AND id <> $2`,
        [slug, sponsorId],
      );
      if (clash.rows[0]) throw new BadRequestException('Slug ya en uso');
    }
    const result = await this.db.query(
      `UPDATE platform_sponsors
       SET name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           logo_url = COALESCE($4, logo_url),
           website_url = COALESCE($5, website_url),
           tagline = COALESCE($6, tagline),
           primary_color = COALESCE($7, primary_color),
           banner_url = COALESCE($8, banner_url),
           home_intro = COALESCE($9, home_intro),
           contact_email = COALESCE($10, contact_email),
           contact_whatsapp = COALESCE($11, contact_whatsapp),
           contact_address = COALESCE($12, contact_address),
           free_shipping_threshold = COALESCE($13, free_shipping_threshold),
           active = COALESCE($14, active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        sponsorId,
        dto.name?.trim() ?? null,
        slug,
        dto.logoUrl ?? null,
        dto.websiteUrl ?? null,
        dto.tagline ?? null,
        dto.primaryColor ?? null,
        dto.bannerUrl ?? null,
        dto.homeIntro ?? null,
        dto.contactEmail ?? null,
        dto.contactWhatsapp ?? null,
        dto.contactAddress ?? null,
        dto.freeShippingThreshold === undefined ? null : dto.freeShippingThreshold,
        dto.active ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException('Partner no encontrado');
    return { ...result.rows[0], store_url: this.storeUrl(result.rows[0]) };
  }

  async addMember(sponsorId: string, dto: AddSponsorMemberDto) {
    await this.db.query(
      `UPDATE users SET role = 'PARTNER'::user_role, updated_at = NOW()
       WHERE id = $1 AND role <> 'SUPER_ADMIN'::user_role`,
      [dto.userId],
    );
    const result = await this.db.query(
      `INSERT INTO platform_sponsor_members (sponsor_id, user_id, role)
       VALUES ($1, $2, COALESCE($3::sponsor_member_role, 'OWNER'))
       ON CONFLICT (sponsor_id, user_id)
       DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [sponsorId, dto.userId, dto.role ?? 'OWNER'],
    );
    return result.rows[0];
  }

  async removeMember(sponsorId: string, userId: string) {
    await this.db.query(
      `DELETE FROM platform_sponsor_members WHERE sponsor_id = $1 AND user_id = $2`,
      [sponsorId, userId],
    );
    return { ok: true };
  }

  async listMembers(sponsorId: string) {
    const result = await this.db.query(
      `SELECT m.*, u.name, u.email, u.role AS user_role
       FROM platform_sponsor_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.sponsor_id = $1
       ORDER BY m.created_at ASC`,
      [sponsorId],
    );
    return result.rows;
  }

  async setDomain(sponsorId: string, dto: SetSponsorDomainDto) {
    const domain = dto.domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/^www\./, '');
    if (!domain || domain.includes('/') || domain.includes(' ')) {
      throw new BadRequestException('Dominio inválido');
    }
    const token = `x4-sponsor-verify=${createHash('sha256')
      .update(`${sponsorId}:${domain}:${Date.now()}`)
      .digest('hex')
      .slice(0, 24)}`;
    const result = await this.db.query(
      `UPDATE platform_sponsors
       SET custom_domain = $2,
           custom_domain_status = 'PENDING_DNS'::sponsor_domain_status,
           custom_domain_verify_token = $3,
           custom_domain_verified_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sponsorId, domain, token],
    );
    if (!result.rows[0]) throw new NotFoundException('Partner no encontrado');
    return {
      ...result.rows[0],
      dns_instructions: {
        cname: this.sponsorsHost(),
        txt: token,
      },
    };
  }

  async verifyDomain(sponsorId: string) {
    const result = await this.db.query(`SELECT * FROM platform_sponsors WHERE id = $1`, [
      sponsorId,
    ]);
    const sponsor = result.rows[0];
    if (!sponsor?.custom_domain) throw new BadRequestException('No hay dominio configurado');

    // MVP: mark ACTIVE after partner confirms DNS setup (ops can also force).
    // Optional TXT check when DNS is reachable.
    let verified = process.env.SPONSOR_DOMAIN_SKIP_DNS === 'true';
    if (!verified && sponsor.custom_domain_verify_token) {
      try {
        const { Resolver } = await import('dns').then((m) => m.promises);
        const resolver = new Resolver();
        const records = await resolver.resolveTxt(sponsor.custom_domain);
        const flat = records.map((r) => r.join('')).join(' ');
        verified = flat.includes(sponsor.custom_domain_verify_token);
      } catch {
        verified = false;
      }
    }
    if (!verified) {
      await this.db.query(
        `UPDATE platform_sponsors
         SET custom_domain_status = 'FAILED'::sponsor_domain_status, updated_at = NOW()
         WHERE id = $1`,
        [sponsorId],
      );
      throw new BadRequestException(
        'No se pudo verificar el DNS. Agregá el TXT o CNAME y reintentá.',
      );
    }
    const updated = await this.db.query(
      `UPDATE platform_sponsors
       SET custom_domain_status = 'ACTIVE'::sponsor_domain_status,
           custom_domain_verified_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sponsorId],
    );
    return { ...updated.rows[0], store_url: this.storeUrl(updated.rows[0]) };
  }

  async removeDomain(sponsorId: string) {
    const result = await this.db.query(
      `UPDATE platform_sponsors
       SET custom_domain = NULL,
           custom_domain_status = 'NONE'::sponsor_domain_status,
           custom_domain_verify_token = NULL,
           custom_domain_verified_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sponsorId],
    );
    return result.rows[0];
  }

  async createProduct(dto: CreatePlatformProductDto) {
    const result = await this.db.query(
      `INSERT INTO platform_products
         (sponsor_id, category_id, name, description, price, compare_at_price, photo_url,
          category, stock_quantity, sort_order, status, is_new, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::platform_product_status, 'DRAFT'),$12,$13)
       RETURNING *`,
      [
        dto.sponsorId ?? null,
        dto.categoryId ?? null,
        dto.name.trim(),
        dto.description?.trim() ?? null,
        dto.price,
        dto.compareAtPrice ?? null,
        dto.photoUrl ?? null,
        dto.category ?? 'MERCH',
        dto.stockQuantity ?? null,
        dto.sortOrder ?? 0,
        dto.status ?? 'DRAFT',
        dto.isNew ?? false,
        dto.featured ?? false,
      ],
    );
    return result.rows[0];
  }

  async updateProduct(productId: string, dto: UpdatePlatformProductDto) {
    const result = await this.db.query(
      `UPDATE platform_products
       SET sponsor_id = COALESCE($2, sponsor_id),
           category_id = COALESCE($3, category_id),
           name = COALESCE($4, name),
           description = COALESCE($5, description),
           price = COALESCE($6, price),
           compare_at_price = COALESCE($7, compare_at_price),
           photo_url = COALESCE($8, photo_url),
           category = COALESCE($9, category),
           stock_quantity = COALESCE($10, stock_quantity),
           sort_order = COALESCE($11, sort_order),
           status = COALESCE($12::platform_product_status, status),
           is_new = COALESCE($13, is_new),
           featured = COALESCE($14, featured),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        productId,
        dto.sponsorId ?? null,
        dto.categoryId === undefined ? null : dto.categoryId,
        dto.name?.trim() ?? null,
        dto.description?.trim() ?? null,
        dto.price ?? null,
        dto.compareAtPrice === undefined ? null : dto.compareAtPrice,
        dto.photoUrl ?? null,
        dto.category ?? null,
        dto.stockQuantity ?? null,
        dto.sortOrder ?? null,
        dto.status ?? null,
        dto.isNew ?? null,
        dto.featured ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException('Producto no encontrado');
    return result.rows[0];
  }

  async deleteProduct(productId: string) {
    await this.db.query(`DELETE FROM platform_products WHERE id = $1`, [productId]);
    return { ok: true };
  }

  async listSponsorProducts(sponsorId: string) {
    const result = await this.db.query(
      `SELECT p.*, c.name AS category_name
       FROM platform_products p
       LEFT JOIN platform_sponsor_categories c ON c.id = p.category_id
       WHERE p.sponsor_id = $1
       ORDER BY p.sort_order ASC, p.created_at DESC`,
      [sponsorId],
    );
    return result.rows;
  }

  async createCategory(sponsorId: string, dto: CreateCategoryDto) {
    const slug = slugify(dto.slug || dto.name);
    const result = await this.db.query(
      `INSERT INTO platform_sponsor_categories (sponsor_id, name, slug, sort_order, active)
       VALUES ($1,$2,$3,$4,COALESCE($5, TRUE))
       RETURNING *`,
      [sponsorId, dto.name.trim(), slug, dto.sortOrder ?? 0, dto.active ?? true],
    );
    return result.rows[0];
  }

  async updateCategory(sponsorId: string, categoryId: string, dto: UpdateCategoryDto) {
    const result = await this.db.query(
      `UPDATE platform_sponsor_categories
       SET name = COALESCE($3, name),
           slug = COALESCE($4, slug),
           sort_order = COALESCE($5, sort_order),
           active = COALESCE($6, active),
           updated_at = NOW()
       WHERE id = $1 AND sponsor_id = $2
       RETURNING *`,
      [
        categoryId,
        sponsorId,
        dto.name?.trim() ?? null,
        dto.slug ? slugify(dto.slug) : null,
        dto.sortOrder ?? null,
        dto.active ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException('Categoría no encontrada');
    return result.rows[0];
  }

  async deleteCategory(sponsorId: string, categoryId: string) {
    await this.db.query(
      `DELETE FROM platform_sponsor_categories WHERE id = $1 AND sponsor_id = $2`,
      [categoryId, sponsorId],
    );
    return { ok: true };
  }

  async listCoupons(sponsorId: string) {
    const result = await this.db.query(
      `SELECT * FROM platform_sponsor_coupons WHERE sponsor_id = $1 ORDER BY created_at DESC`,
      [sponsorId],
    );
    return result.rows;
  }

  async createCoupon(sponsorId: string, dto: CreateCouponDto) {
    if (dto.discountPercent == null && dto.discountAmount == null) {
      throw new BadRequestException('Indicá descuento % o monto');
    }
    const result = await this.db.query(
      `INSERT INTO platform_sponsor_coupons
         (sponsor_id, code, label, discount_percent, discount_amount, max_uses, expires_at)
       VALUES ($1, upper($2), $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        sponsorId,
        dto.code.trim(),
        dto.label ?? null,
        dto.discountPercent ?? null,
        dto.discountAmount ?? null,
        dto.maxUses ?? null,
        dto.expiresAt ?? null,
      ],
    );
    return result.rows[0];
  }

  async deactivateCoupon(sponsorId: string, couponId: string) {
    const result = await this.db.query(
      `UPDATE platform_sponsor_coupons SET active = FALSE
       WHERE id = $1 AND sponsor_id = $2 RETURNING *`,
      [couponId, sponsorId],
    );
    return result.rows[0];
  }

  async listShippingMethods(sponsorId: string) {
    const result = await this.db.query(
      `SELECT * FROM platform_sponsor_shipping_methods
       WHERE sponsor_id = $1 ORDER BY sort_order ASC`,
      [sponsorId],
    );
    return result.rows;
  }

  async createShippingMethod(sponsorId: string, dto: CreateShippingMethodDto) {
    const result = await this.db.query(
      `INSERT INTO platform_sponsor_shipping_methods
         (sponsor_id, type, name, price, min_order, sort_order, active)
       VALUES ($1,$2::sponsor_shipping_type,$3,$4,$5,$6,COALESCE($7, TRUE))
       RETURNING *`,
      [
        sponsorId,
        dto.type,
        dto.name.trim(),
        dto.price ?? 0,
        dto.minOrder ?? null,
        dto.sortOrder ?? 0,
        dto.active ?? true,
      ],
    );
    return result.rows[0];
  }

  async updateShippingMethod(
    sponsorId: string,
    methodId: string,
    dto: UpdateShippingMethodDto,
  ) {
    const result = await this.db.query(
      `UPDATE platform_sponsor_shipping_methods
       SET type = COALESCE($3::sponsor_shipping_type, type),
           name = COALESCE($4, name),
           price = COALESCE($5, price),
           min_order = COALESCE($6, min_order),
           sort_order = COALESCE($7, sort_order),
           active = COALESCE($8, active),
           updated_at = NOW()
       WHERE id = $1 AND sponsor_id = $2
       RETURNING *`,
      [
        methodId,
        sponsorId,
        dto.type ?? null,
        dto.name?.trim() ?? null,
        dto.price ?? null,
        dto.minOrder ?? null,
        dto.sortOrder ?? null,
        dto.active ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException('Método no encontrado');
    return result.rows[0];
  }

  async deleteShippingMethod(sponsorId: string, methodId: string) {
    await this.db.query(
      `DELETE FROM platform_sponsor_shipping_methods WHERE id = $1 AND sponsor_id = $2`,
      [methodId, sponsorId],
    );
    return { ok: true };
  }

  async listSponsorOrders(sponsorId: string) {
    const result = await this.db.query(
      `SELECT o.*,
              COALESCE(o.guest_name, c.name, u.name) AS buyer_name,
              COALESCE(o.guest_email, c.email, u.email) AS buyer_email
       FROM platform_orders o
       LEFT JOIN platform_sponsor_customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.sponsor_id = $1
       ORDER BY o.created_at DESC
       LIMIT 200`,
      [sponsorId],
    );
    return result.rows;
  }

  async updateOrderStatus(sponsorId: string, orderId: string, dto: UpdateOrderStatusDto) {
    const result = await this.db.query(
      `UPDATE platform_orders
       SET status = $3::platform_order_status,
           payment_status = CASE
             WHEN $3 = 'PAID' THEN 'APPROVED'::payment_status
             WHEN $3 = 'CANCELLED' THEN 'REJECTED'::payment_status
             ELSE payment_status
           END,
           updated_at = NOW()
       WHERE id = $1 AND sponsor_id = $2
       RETURNING *`,
      [orderId, sponsorId, dto.status],
    );
    if (!result.rows[0]) throw new NotFoundException('Pedido no encontrado');
    return result.rows[0];
  }

  async listAllOrders() {
    const result = await this.db.query(
      `SELECT o.*,
              COALESCE(o.guest_name, c.name, u.name) AS buyer_name,
              COALESCE(o.guest_email, c.email, u.email) AS buyer_email,
              s.name AS sponsor_name, s.slug AS sponsor_slug
       FROM platform_orders o
       LEFT JOIN platform_sponsor_customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN platform_sponsors s ON s.id = o.sponsor_id
       ORDER BY o.created_at DESC
       LIMIT 200`,
    );
    return result.rows;
  }

  async markOrderPaidFromWebhook(orderId: string) {
    const result = await this.db.query(
      `UPDATE platform_orders
       SET status = 'PAID',
           payment_status = 'APPROVED',
           payment_provider = 'MERCADOPAGO',
           updated_at = NOW()
       WHERE id = $1 AND status IN ('PENDING', 'AWAITING_MANUAL_PAYMENT')
       RETURNING *`,
      [orderId],
    );
    return result.rows[0] ?? null;
  }
}
