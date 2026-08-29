import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isClubRole } from '../common/roles';
import { DatabaseService } from '../database/database.service';
import { AddShopPurchaseDto } from './dto/add-shop-purchase.dto';
import { CheckoutShopDto } from './dto/checkout-shop.dto';
import { CreateShopProductDto } from './dto/create-shop-product.dto';
import { UpdateShopProductDto } from './dto/update-shop-product.dto';

@Injectable()
export class ShopService {
  constructor(private readonly db: DatabaseService) {}

  async listProducts(clubId: string, kind?: string) {
    await this.assertClubExists(clubId);

    const params: unknown[] = [clubId];
    let kindFilter = '';
    if (kind === 'MATCH_ADDON' || kind === 'GENERAL') {
      kindFilter = ' AND kind = $2::shop_product_kind';
      params.push(kind);
    }

    const result = await this.db.query(
      `SELECT id, club_id, name, description, price, kind, category, photo_url, active, sort_order, created_at
       FROM club_shop_products
       WHERE club_id = $1 AND active = TRUE${kindFilter}
       ORDER BY sort_order ASC, name ASC`,
      params,
    );
    return result.rows;
  }

  async listProductsForClubAdmin(clubId: string, userId: string) {
    await this.assertClubRole(userId);
    await this.assertClubExists(clubId);

    const result = await this.db.query(
      `SELECT id, club_id, name, description, price, kind, category, photo_url, active, sort_order, created_at, updated_at
       FROM club_shop_products
       WHERE club_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [clubId],
    );
    return result.rows;
  }

  async createProduct(clubId: string, userId: string, dto: CreateShopProductDto) {
    await this.assertClubRole(userId);
    await this.assertClubExists(clubId);

    const result = await this.db.query(
      `INSERT INTO club_shop_products (
         club_id, name, description, price, kind, category, active, sort_order
       ) VALUES ($1, $2, $3, $4, $5::shop_product_kind, $6, $7, $8)
       RETURNING *`,
      [
        clubId,
        dto.name.trim(),
        dto.description?.trim() ?? null,
        dto.price,
        dto.kind ?? 'GENERAL',
        dto.category ?? 'OTHER',
        dto.active ?? true,
        dto.sortOrder ?? 0,
      ],
    );
    return result.rows[0];
  }

  async updateProduct(clubId: string, userId: string, productId: string, dto: UpdateShopProductDto) {
    await this.assertClubRole(userId);

    const result = await this.db.query(
      `UPDATE club_shop_products
       SET name = COALESCE($3, name),
           description = COALESCE($4, description),
           price = COALESCE($5, price),
           kind = COALESCE($6::shop_product_kind, kind),
           category = COALESCE($7, category),
           active = COALESCE($8, active),
           sort_order = COALESCE($9, sort_order),
           updated_at = NOW()
       WHERE id = $1 AND club_id = $2
       RETURNING *`,
      [
        productId,
        clubId,
        dto.name?.trim() ?? null,
        dto.description?.trim() ?? null,
        dto.price ?? null,
        dto.kind ?? null,
        dto.category ?? null,
        dto.active ?? null,
        dto.sortOrder ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Producto no encontrado');
    }
    return result.rows[0];
  }

  async deactivateProduct(clubId: string, userId: string, productId: string) {
    await this.assertClubRole(userId);
    const result = await this.db.query(
      `UPDATE club_shop_products SET active = FALSE, updated_at = NOW()
       WHERE id = $1 AND club_id = $2
       RETURNING id`,
      [productId, clubId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Producto no encontrado');
    }
    return { ok: true };
  }

  async listMatchPurchases(matchId: string) {
    const match = await this.getMatchWithClub(matchId);
    if (!match.club_id) {
      return { items: [], total: 0 };
    }

    const result = await this.db.query(
      `SELECT sp.id,
              sp.match_id,
              sp.user_id,
              sp.product_id,
              sp.quantity,
              sp.unit_price,
              sp.subtotal,
              sp.status,
              sp.created_at,
              p.name AS product_name,
              p.kind AS product_kind,
              p.category,
              u.name AS user_name,
              pl.nickname
       FROM shop_purchases sp
       INNER JOIN club_shop_products p ON p.id = sp.product_id
       INNER JOIN users u ON u.id = sp.user_id
       LEFT JOIN players pl ON pl.user_id = sp.user_id
       WHERE sp.match_id = $1 AND sp.status <> 'CANCELLED'
       ORDER BY sp.created_at ASC`,
      [matchId],
    );

    const total = result.rows.reduce((sum, row) => sum + Number(row.subtotal), 0);
    return { items: result.rows, total };
  }

  async addMatchPurchase(matchId: string, userId: string, dto: AddShopPurchaseDto) {
    const match = await this.getMatchWithClub(matchId);
    if (!match.club_id) {
      throw new BadRequestException('Este partido no está asociado a un club');
    }

    await this.assertMatchParticipant(matchId, userId);

    if (!['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS'].includes(match.status)) {
      throw new BadRequestException('No se pueden agregar extras en este estado del partido');
    }

    const product = await this.getActiveProduct(dto.productId, match.club_id);
    if (product.kind !== 'MATCH_ADDON') {
      throw new BadRequestException('Este producto no está disponible como extra de partido');
    }

    const quantity = dto.quantity ?? 1;
    const unitPrice = Number(product.price);
    const subtotal = Math.round(unitPrice * quantity * 100) / 100;

    const existing = await this.db.query(
      `SELECT id, quantity, status FROM shop_purchases
       WHERE match_id = $1 AND user_id = $2 AND product_id = $3 AND status = 'PENDING'`,
      [matchId, userId, dto.productId],
    );

    if (existing.rows[0]) {
      const newQty = existing.rows[0].quantity + quantity;
      const updated = await this.db.query(
        `UPDATE shop_purchases
         SET quantity = $2,
             subtotal = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, newQty, unitPrice * newQty],
      );
      return this.enrichPurchase(updated.rows[0]);
    }

    const inserted = await this.db.query(
      `INSERT INTO shop_purchases (
         club_id, user_id, match_id, product_id, quantity, unit_price, subtotal, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING *`,
      [match.club_id, userId, matchId, dto.productId, quantity, unitPrice, subtotal],
    );

    return this.enrichPurchase(inserted.rows[0]);
  }

  async removePurchase(purchaseId: string, userId: string) {
    const row = await this.db.query(
      `SELECT id, user_id, status FROM shop_purchases WHERE id = $1`,
      [purchaseId],
    );
    const purchase = row.rows[0];
    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }
    if (purchase.user_id !== userId) {
      throw new ForbiddenException('Solo podés cancelar tus propios pedidos');
    }
    if (purchase.status !== 'PENDING') {
      throw new BadRequestException('Este pedido ya no se puede cancelar');
    }

    await this.db.query(
      `UPDATE shop_purchases SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [purchaseId],
    );
    return { ok: true };
  }

  async checkout(clubId: string, userId: string, dto: CheckoutShopDto) {
    await this.assertClubExists(clubId);

    if (!dto.items?.length) {
      throw new BadRequestException('Agregá al menos un producto');
    }

    let matchClubId: string | null = null;
    if (dto.matchId) {
      const match = await this.getMatchWithClub(dto.matchId);
      if (match.club_id !== clubId) {
        throw new BadRequestException('El partido no pertenece a este club');
      }
      await this.assertMatchParticipant(dto.matchId, userId);
      matchClubId = match.club_id;
    }

    const purchases = [];
    for (const item of dto.items) {
      const product = await this.getActiveProduct(item.productId, clubId);
      if (dto.matchId && product.kind !== 'MATCH_ADDON') {
        throw new BadRequestException(`"${product.name}" no es un extra de partido`);
      }
      if (!dto.matchId && product.kind === 'MATCH_ADDON') {
        throw new BadRequestException(
          `Para "${product.name}" indicá un partido o compralo desde el detalle del partido`,
        );
      }

      const quantity = item.quantity ?? 1;
      const unitPrice = Number(product.price);
      const subtotal = unitPrice * quantity;

      const inserted = await this.db.query(
        `INSERT INTO shop_purchases (
           club_id, user_id, match_id, product_id, quantity, unit_price, subtotal, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
         RETURNING *`,
        [clubId, userId, dto.matchId ?? null, item.productId, quantity, unitPrice, subtotal],
      );
      purchases.push(inserted.rows[0]);
    }

    const total = purchases.reduce((s, p) => s + Number(p.subtotal), 0);
    return { purchases, total, matchId: matchClubId ? dto.matchId : null };
  }

  async listClubSales(clubId: string, userId: string, limit = 50) {
    await this.assertClubRole(userId);
    const result = await this.db.query(
      `SELECT sp.id,
              sp.match_id,
              sp.user_id,
              sp.quantity,
              sp.unit_price,
              sp.subtotal,
              sp.status,
              sp.created_at,
              p.name AS product_name,
              u.name AS user_name,
              m.title AS match_title
       FROM shop_purchases sp
       INNER JOIN club_shop_products p ON p.id = sp.product_id
       INNER JOIN users u ON u.id = sp.user_id
       LEFT JOIN matches m ON m.id = sp.match_id
       WHERE sp.club_id = $1 AND sp.status <> 'CANCELLED'
       ORDER BY sp.created_at DESC
       LIMIT $2`,
      [clubId, limit],
    );
    return result.rows;
  }

  private async enrichPurchase(row: Record<string, unknown>) {
    const detail = await this.db.query(
      `SELECT p.name AS product_name, p.kind AS product_kind, p.category
       FROM club_shop_products p WHERE p.id = $1`,
      [row.product_id],
    );
    return { ...row, ...detail.rows[0] };
  }

  private async getActiveProduct(productId: string, clubId: string) {
    const result = await this.db.query(
      `SELECT id, club_id, name, price, kind, active
       FROM club_shop_products
       WHERE id = $1 AND club_id = $2 AND active = TRUE`,
      [productId, clubId],
    );
    const product = result.rows[0];
    if (!product) {
      throw new NotFoundException('Producto no disponible');
    }
    return product;
  }

  private async getMatchWithClub(matchId: string) {
    const result = await this.db.query(
      `SELECT id, club_id, status, title FROM matches WHERE id = $1`,
      [matchId],
    );
    const match = result.rows[0];
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }
    return match;
  }

  private async assertMatchParticipant(matchId: string, userId: string) {
    const result = await this.db.query(
      `SELECT 1
       FROM match_players mp
       INNER JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = $1 AND p.user_id = $2
         AND mp.status IN ('JOINED', 'CONFIRMED')`,
      [matchId, userId],
    );
    if (!result.rows[0]) {
      throw new ForbiddenException('Tenés que participar del partido para agregar extras');
    }
  }

  private async assertClubExists(clubId: string) {
    const result = await this.db.query(`SELECT id FROM clubs WHERE id = $1`, [clubId]);
    if (!result.rows[0]) {
      throw new NotFoundException('Club no encontrado');
    }
  }

  private async assertClubRole(userId: string) {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (!isClubRole(result.rows[0]?.role)) {
      throw new ForbiddenException('Solo cuentas de club pueden gestionar la tienda');
    }
  }

}
