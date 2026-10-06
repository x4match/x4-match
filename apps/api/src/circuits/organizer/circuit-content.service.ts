import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { uploadImageBuffer } from '../../common/cloudinary/cloudinary.util';
import { DatabaseService } from '../../database/database.service';
import { CircuitAccessService } from '../circuit-access.service';
import {
  CreateCircuitNewsDto,
  CreateCircuitSponsorDto,
  UpdateCircuitNewsDto,
  UpdateCircuitSponsorDto,
} from '../dto/circuit-organizer.dto';
import { CircuitAuditService } from './circuit-audit.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

@Injectable()
export class CircuitContentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: CircuitAccessService,
    private readonly audit: CircuitAuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Noticias
  // ---------------------------------------------------------------------------

  async listNews(circuitId: string, limit = 30) {
    const result = await this.db.query(
      `SELECT n.*, u.name AS author_name
       FROM circuit_news n
       LEFT JOIN users u ON u.id = n.author_user_id
       WHERE n.circuit_id = $1
       ORDER BY n.pinned DESC, n.published_at DESC
       LIMIT $2`,
      [circuitId, Math.min(Math.max(Number(limit) || 30, 1), 100)],
    );
    return result.rows;
  }

  async createNews(circuitId: string, userId: string, dto: CreateCircuitNewsDto) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const result = await this.db.query(
      `INSERT INTO circuit_news (circuit_id, title, body, image_url, pinned, author_user_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [circuitId, dto.title.trim(), dto.body.trim(), dto.imageUrl ?? null, !!dto.pinned, userId],
    );
    const row = result.rows[0];
    await this.audit.log(circuitId, userId, {
      action: 'news.create',
      entityType: 'circuit_news',
      entityId: row.id,
      summary: `Publicó la noticia "${row.title}"`,
    });
    return row;
  }

  async updateNews(circuitId: string, newsId: string, userId: string, dto: UpdateCircuitNewsDto) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const sets: string[] = [];
    const values: unknown[] = [newsId, circuitId];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (dto.title !== undefined) set('title', dto.title.trim());
    if (dto.body !== undefined) set('body', dto.body.trim());
    if (dto.imageUrl !== undefined) set('image_url', dto.imageUrl || null);
    if (dto.pinned !== undefined) set('pinned', dto.pinned);
    if (!sets.length) return this.findNews(circuitId, newsId);

    const result = await this.db.query(
      `UPDATE circuit_news SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND circuit_id = $2 RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new NotFoundException('Noticia no encontrada');
    await this.audit.log(circuitId, userId, {
      action: 'news.update',
      entityType: 'circuit_news',
      entityId: newsId,
      summary: `Editó la noticia "${result.rows[0].title}"`,
    });
    return result.rows[0];
  }

  async uploadNewsImage(circuitId: string, newsId: string, userId: string, file: Express.Multer.File) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    await this.findNews(circuitId, newsId);
    const url = await this.upload(file, `playtomic-clone/circuits/${circuitId}/news`, 1200, 675);
    const result = await this.db.query(
      `UPDATE circuit_news SET image_url = $3, updated_at = NOW()
       WHERE id = $1 AND circuit_id = $2 RETURNING *`,
      [newsId, circuitId, url],
    );
    return result.rows[0];
  }

  async deleteNews(circuitId: string, newsId: string, userId: string) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const result = await this.db.query(
      `DELETE FROM circuit_news WHERE id = $1 AND circuit_id = $2 RETURNING title`,
      [newsId, circuitId],
    );
    if (!result.rows[0]) throw new NotFoundException('Noticia no encontrada');
    await this.audit.log(circuitId, userId, {
      action: 'news.delete',
      entityType: 'circuit_news',
      entityId: newsId,
      summary: `Borró la noticia "${result.rows[0].title}"`,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Sponsors
  // ---------------------------------------------------------------------------

  async listSponsors(circuitId: string) {
    const result = await this.db.query(
      `SELECT * FROM circuit_sponsors WHERE circuit_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [circuitId],
    );
    return result.rows;
  }

  async createSponsor(circuitId: string, userId: string, dto: CreateCircuitSponsorDto) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const result = await this.db.query(
      `INSERT INTO circuit_sponsors (circuit_id, name, website, tier, sort_order)
       VALUES ($1,$2,$3,$4,
         COALESCE($5, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM circuit_sponsors WHERE circuit_id = $1)))
       RETURNING *`,
      [circuitId, dto.name.trim(), normalizeUrl(dto.website), dto.tier ?? 'SUPPORT', dto.sortOrder ?? null],
    );
    const row = result.rows[0];
    await this.audit.log(circuitId, userId, {
      action: 'sponsor.create',
      entityType: 'circuit_sponsor',
      entityId: row.id,
      summary: `Sumó el sponsor ${row.name}`,
    });
    return row;
  }

  async updateSponsor(circuitId: string, sponsorId: string, userId: string, dto: UpdateCircuitSponsorDto) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const sets: string[] = [];
    const values: unknown[] = [sponsorId, circuitId];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (dto.name !== undefined) set('name', dto.name.trim());
    if (dto.website !== undefined) set('website', normalizeUrl(dto.website));
    if (dto.tier !== undefined) set('tier', dto.tier);
    if (dto.sortOrder !== undefined) set('sort_order', dto.sortOrder);
    if (!sets.length) return this.findSponsor(circuitId, sponsorId);
    const result = await this.db.query(
      `UPDATE circuit_sponsors SET ${sets.join(', ')} WHERE id = $1 AND circuit_id = $2 RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new NotFoundException('Sponsor no encontrado');
    return result.rows[0];
  }

  async uploadSponsorLogo(circuitId: string, sponsorId: string, userId: string, file: Express.Multer.File) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    await this.findSponsor(circuitId, sponsorId);
    const url = await this.upload(file, `playtomic-clone/circuits/${circuitId}/sponsors`, 600, 300, 'limit');
    const result = await this.db.query(
      `UPDATE circuit_sponsors SET logo_url = $3 WHERE id = $1 AND circuit_id = $2 RETURNING *`,
      [sponsorId, circuitId, url],
    );
    return result.rows[0];
  }

  async deleteSponsor(circuitId: string, sponsorId: string, userId: string) {
    await this.access.assert(circuitId, userId, 'circuit.edit');
    const result = await this.db.query(
      `DELETE FROM circuit_sponsors WHERE id = $1 AND circuit_id = $2 RETURNING name`,
      [sponsorId, circuitId],
    );
    if (!result.rows[0]) throw new NotFoundException('Sponsor no encontrado');
    await this.audit.log(circuitId, userId, {
      action: 'sponsor.delete',
      entityType: 'circuit_sponsor',
      entityId: sponsorId,
      summary: `Quitó el sponsor ${result.rows[0].name}`,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------

  private async upload(
    file: Express.Multer.File,
    folder: string,
    width: number,
    height: number,
    crop: 'fill' | 'limit' = 'fill',
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Archivo requerido');
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }
    const upload = await uploadImageBuffer(file, folder, { width, height, crop });
    return upload.secure_url as string;
  }

  private async findNews(circuitId: string, newsId: string) {
    const result = await this.db.query(
      `SELECT * FROM circuit_news WHERE id = $1 AND circuit_id = $2`,
      [newsId, circuitId],
    );
    if (!result.rows[0]) throw new NotFoundException('Noticia no encontrada');
    return result.rows[0];
  }

  private async findSponsor(circuitId: string, sponsorId: string) {
    const result = await this.db.query(
      `SELECT * FROM circuit_sponsors WHERE id = $1 AND circuit_id = $2`,
      [sponsorId, circuitId],
    );
    if (!result.rows[0]) throw new NotFoundException('Sponsor no encontrado');
    return result.rows[0];
  }
}

function normalizeUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
