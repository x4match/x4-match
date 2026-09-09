import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreatePlatformOrderDto,
  CreatePlatformProductDto,
  CreatePlatformSponsorDto,
  UpdatePlatformProductDto,
} from './dto/platform-shop.dto';

@Injectable()
export class PlatformShopService {
  constructor(private readonly db: DatabaseService) {}

  async listActiveProducts() {
    const result = await this.db.query(
      `SELECT p.id, p.name, p.description, p.price, p.currency, p.photo_url,
              p.stock_quantity, p.category, p.sort_order, p.status,
              s.id AS sponsor_id, s.name AS sponsor_name, s.logo_url AS sponsor_logo_url
       FROM platform_products p
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       WHERE p.status = 'ACTIVE'
       ORDER BY p.sort_order ASC, p.name ASC`,
    );
    return result.rows;
  }

  async getProduct(productId: string) {
    const result = await this.db.query(
      `SELECT p.*, s.name AS sponsor_name, s.logo_url AS sponsor_logo_url, s.website_url AS sponsor_website_url
       FROM platform_products p
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       WHERE p.id = $1`,
      [productId],
    );
    if (!result.rows[0]) throw new NotFoundException('Producto no encontrado');
    return result.rows[0];
  }

  async createOrder(userId: string, dto: CreatePlatformOrderDto) {
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
         (user_id, status, total, currency, payment_status, shipping_note)
       VALUES ($1, 'PENDING', $2, $3, 'PENDING', $4)
       RETURNING *`,
      [userId, subtotal, product.currency || 'ARS', dto.shippingNote?.trim() || null],
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

  // --- Admin ---

  async listAllProducts() {
    const result = await this.db.query(
      `SELECT p.*, s.name AS sponsor_name
       FROM platform_products p
       LEFT JOIN platform_sponsors s ON s.id = p.sponsor_id
       ORDER BY p.sort_order ASC, p.created_at DESC`,
    );
    return result.rows;
  }

  async listSponsors() {
    const result = await this.db.query(
      `SELECT * FROM platform_sponsors ORDER BY name ASC`,
    );
    return result.rows;
  }

  async createSponsor(dto: CreatePlatformSponsorDto) {
    const result = await this.db.query(
      `INSERT INTO platform_sponsors (name, logo_url, website_url)
       VALUES ($1, $2, $3) RETURNING *`,
      [dto.name.trim(), dto.logoUrl ?? null, dto.websiteUrl ?? null],
    );
    return result.rows[0];
  }

  async createProduct(dto: CreatePlatformProductDto) {
    const result = await this.db.query(
      `INSERT INTO platform_products
         (sponsor_id, name, description, price, photo_url, category, stock_quantity, sort_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::platform_product_status, 'DRAFT'))
       RETURNING *`,
      [
        dto.sponsorId ?? null,
        dto.name.trim(),
        dto.description?.trim() ?? null,
        dto.price,
        dto.photoUrl ?? null,
        dto.category ?? 'MERCH',
        dto.stockQuantity ?? null,
        dto.sortOrder ?? 0,
        dto.status ?? 'DRAFT',
      ],
    );
    return result.rows[0];
  }

  async updateProduct(productId: string, dto: UpdatePlatformProductDto) {
    const result = await this.db.query(
      `UPDATE platform_products
       SET sponsor_id = COALESCE($2, sponsor_id),
           name = COALESCE($3, name),
           description = COALESCE($4, description),
           price = COALESCE($5, price),
           photo_url = COALESCE($6, photo_url),
           category = COALESCE($7, category),
           stock_quantity = COALESCE($8, stock_quantity),
           sort_order = COALESCE($9, sort_order),
           status = COALESCE($10::platform_product_status, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        productId,
        dto.sponsorId ?? null,
        dto.name?.trim() ?? null,
        dto.description?.trim() ?? null,
        dto.price ?? null,
        dto.photoUrl ?? null,
        dto.category ?? null,
        dto.stockQuantity ?? null,
        dto.sortOrder ?? null,
        dto.status ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException('Producto no encontrado');
    return result.rows[0];
  }

  async listAllOrders() {
    const result = await this.db.query(
      `SELECT o.*, u.name AS user_name, u.email AS user_email
       FROM platform_orders o
       INNER JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC
       LIMIT 100`,
    );
    return result.rows;
  }
}
