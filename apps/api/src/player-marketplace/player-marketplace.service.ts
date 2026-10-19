import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { deleteCloudinaryAsset, uploadImageBuffer } from '../common/cloudinary/cloudinary.util';
import { DatabaseService } from '../database/database.service';
import { CreatePlayerListingDto, UpdatePlayerListingDto } from './dto/player-listing.dto';

const SELLER_ROLES = ['PLAYER', 'ORGANIZER'];
const MAX_PHOTOS = 5;
const MAX_ACTIVE_LISTINGS = 30;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const LISTING_SELECT = `
  SELECT l.id, l.seller_user_id, l.title, l.description, l.price, l.currency, l.category,
         l.condition, COALESCE(NULLIF(l.city, ''), p.city) AS city, l.photo_urls, l.status,
         l.sold_at, l.created_at, l.updated_at,
         u.name AS seller_name, p.nickname AS seller_nickname, p.photo_url AS seller_photo_url
  FROM player_listings l
  JOIN users u ON u.id = l.seller_user_id
  LEFT JOIN players p ON p.user_id = l.seller_user_id`;

@Injectable()
export class PlayerMarketplaceService {
  constructor(private readonly db: DatabaseService) {}

  async listActive(viewerId?: string) {
    const params: unknown[] = [];
    let blockFilter = '';
    if (viewerId) {
      params.push(viewerId);
      blockFilter = `
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE (b.blocker_id = $1 AND b.blocked_id = l.seller_user_id)
             OR (b.blocker_id = l.seller_user_id AND b.blocked_id = $1)
        )`;
    }
    const result = await this.db.query(
      `${LISTING_SELECT}
       WHERE l.status = 'ACTIVE'${blockFilter}
       ORDER BY l.created_at DESC
       LIMIT 500`,
      params,
    );
    return result.rows;
  }

  async listMine(userId: string) {
    const result = await this.db.query(
      `${LISTING_SELECT}
       WHERE l.seller_user_id = $1 AND l.status <> 'DELETED'
       ORDER BY
         CASE l.status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2 END,
         l.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async getListing(listingId: string, viewerId?: string) {
    const result = await this.db.query(`${LISTING_SELECT} WHERE l.id = $1`, [listingId]);
    const listing = result.rows[0];
    const isOwner = !!viewerId && listing?.seller_user_id === viewerId;
    if (!listing || listing.status === 'DELETED' || (!isOwner && listing.status === 'PAUSED')) {
      throw new NotFoundException('Publicación no encontrada');
    }
    return listing;
  }

  async create(userId: string, dto: CreatePlayerListingDto) {
    await this.assertCanSell(userId);

    const active = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM player_listings
       WHERE seller_user_id = $1 AND status IN ('ACTIVE', 'PAUSED')`,
      [userId],
    );
    if ((active.rows[0]?.total ?? 0) >= MAX_ACTIVE_LISTINGS) {
      throw new BadRequestException(
        `Podés tener hasta ${MAX_ACTIVE_LISTINGS} publicaciones abiertas. Marcá alguna como vendida o eliminala.`,
      );
    }

    const inserted = await this.db.query(
      `INSERT INTO player_listings (seller_user_id, title, description, price, category, condition, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId,
        dto.title.trim(),
        dto.description?.trim() || null,
        Math.round(dto.price),
        dto.category,
        dto.condition,
        dto.city?.trim() || null,
      ],
    );
    return this.getListing(inserted.rows[0].id, userId);
  }

  async update(userId: string, listingId: string, dto: UpdatePlayerListingDto) {
    const current = await this.assertOwner(userId, listingId);
    if (dto.status === 'ACTIVE' && current.status !== 'ACTIVE') {
      await this.assertCanSell(userId);
    }

    await this.db.query(
      `UPDATE player_listings
       SET title = COALESCE($3, title),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           price = COALESCE($6, price),
           category = COALESCE($7, category),
           condition = COALESCE($8, condition),
           city = CASE WHEN $9::boolean THEN $10 ELSE city END,
           status = COALESCE($11, status),
           sold_at = CASE
             WHEN $11 = 'SOLD' AND status <> 'SOLD' THEN NOW()
             WHEN $11 IS NOT NULL AND $11 <> 'SOLD' THEN NULL
             ELSE sold_at
           END,
           updated_at = NOW()
       WHERE id = $1 AND seller_user_id = $2`,
      [
        listingId,
        userId,
        dto.title?.trim() ?? null,
        dto.description !== undefined,
        dto.description?.trim() || null,
        dto.price != null ? Math.round(dto.price) : null,
        dto.category ?? null,
        dto.condition ?? null,
        dto.city !== undefined,
        dto.city?.trim() || null,
        dto.status ?? null,
      ],
    );
    return this.getListing(listingId, userId);
  }

  async remove(userId: string, listingId: string) {
    const current = await this.assertOwner(userId, listingId);
    await this.db.query(
      `UPDATE player_listings SET status = 'DELETED', updated_at = NOW() WHERE id = $1`,
      [listingId],
    );
    for (const url of (current.photo_urls as string[]) ?? []) {
      await deleteCloudinaryAsset(url);
    }
    return { success: true };
  }

  async addPhoto(userId: string, listingId: string, file: Express.Multer.File) {
    const current = await this.assertOwner(userId, listingId);
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }
    if (((current.photo_urls as string[]) ?? []).length >= MAX_PHOTOS) {
      throw new BadRequestException(`Podés subir hasta ${MAX_PHOTOS} fotos por publicación.`);
    }

    const upload = await uploadImageBuffer(file, `playtomic-clone/marketplace/${userId}`, {
      width: 1080,
      crop: 'limit',
    });
    await this.db.query(
      `UPDATE player_listings
       SET photo_urls = array_append(photo_urls, $2), updated_at = NOW()
       WHERE id = $1`,
      [listingId, upload.secure_url],
    );
    return this.getListing(listingId, userId);
  }

  async removePhoto(userId: string, listingId: string, url: string) {
    const current = await this.assertOwner(userId, listingId);
    if (!((current.photo_urls as string[]) ?? []).includes(url)) {
      throw new NotFoundException('Foto no encontrada');
    }
    await this.db.query(
      `UPDATE player_listings
       SET photo_urls = array_remove(photo_urls, $2), updated_at = NOW()
       WHERE id = $1`,
      [listingId, url],
    );
    await deleteCloudinaryAsset(url);
    return this.getListing(listingId, userId);
  }

  private async assertCanSell(userId: string) {
    const result = await this.db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = result.rows[0]?.role as string | undefined;
    if (!role || !SELLER_ROLES.includes(role)) {
      throw new ForbiddenException('Solo los jugadores pueden publicar en el marketplace.');
    }
  }

  private async assertOwner(userId: string, listingId: string) {
    const result = await this.db.query(
      `SELECT id, seller_user_id, status, photo_urls FROM player_listings WHERE id = $1`,
      [listingId],
    );
    const listing = result.rows[0];
    if (!listing || listing.status === 'DELETED') {
      throw new NotFoundException('Publicación no encontrada');
    }
    if (listing.seller_user_id !== userId) {
      throw new ForbiddenException('Esta publicación no es tuya.');
    }
    return listing;
  }
}
