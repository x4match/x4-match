import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClubsService } from '../clubs/clubs.service';
import { uploadImageBuffer } from '../common/cloudinary/cloudinary.util';
import {
  CreateNewsPostDto,
  NEWS_MAX_DURATION_DAYS,
  NEWS_MAX_LIVE_PER_CLUB,
  NEWS_MAX_PENDING_PER_PLAYER,
} from './dto/news.dto';

type NewsSettingKey = keyof NewsSettings;

export interface NewsSettings {
  defaultDurationDays: number;
  maxLivePerClub: number;
  maxPendingPerPlayer: number;
}

const NEWS_SETTINGS: Record<
  NewsSettingKey,
  { key: string; fallback: number; min: number; max: number }
> = {
  defaultDurationDays: {
    key: 'news.default_duration_days',
    fallback: 7,
    min: 1,
    max: NEWS_MAX_DURATION_DAYS,
  },
  maxLivePerClub: {
    key: 'news.max_live_per_club',
    fallback: 10,
    min: 1,
    max: NEWS_MAX_LIVE_PER_CLUB,
  },
  maxPendingPerPlayer: {
    key: 'news.max_pending_per_player',
    fallback: 3,
    min: 1,
    max: NEWS_MAX_PENDING_PER_PLAYER,
  },
};
const FEATURED_FEED_LIMIT = 10;
const LIVE_WHERE = `n.status = 'APPROVED' AND n.published_at <= NOW() AND n.expires_at > NOW()`;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const NEWS_SELECT = `
  SELECT n.*,
         au.name AS author_name,
         ap.photo_url AS author_photo_url,
         c.name AS club_name,
         c.logo_url AS club_logo_url,
         rv.name AS reviewed_by_name,
         (n.status = 'APPROVED' AND n.published_at <= NOW() AND n.expires_at > NOW()) AS is_live
  FROM news_posts n
  INNER JOIN users au ON au.id = n.author_user_id
  LEFT JOIN players ap ON ap.user_id = n.author_user_id
  LEFT JOIN clubs c ON c.id = n.club_id
  LEFT JOIN users rv ON rv.id = n.reviewed_by_user_id`;

const NEWS_SOURCES = ['CLUB', 'PLAYER', 'PLATFORM'] as const;
type NewsSource = (typeof NEWS_SOURCES)[number];

function isNewsSource(value?: string): value is NewsSource {
  return !!value && (NEWS_SOURCES as readonly string[]).includes(value);
}

export type NewsAdminStatusFilter = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REJECTED' | 'DELETED';

function mapNews(row: any) {
  return {
    id: row.id as string,
    source: row.source as NewsSource,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    linkUrl: (row.link_url as string | null) ?? null,
    imageUrl: row.image_url as string,
    status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED',
    isLive: Boolean(row.is_live),
    isFeatured: Boolean(row.is_featured),
    featuredAt: row.featured_at ?? null,
    durationDays: Number(row.duration_days),
    publishedAt: row.published_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
    reviewNotes: (row.review_notes as string | null) ?? null,
    reviewedByName: (row.reviewed_by_name as string | null) ?? null,
    author: {
      id: row.author_user_id as string,
      name: row.author_name as string,
      photoUrl: (row.author_photo_url as string | null) ?? null,
    },
    club: row.club_id
      ? {
          id: row.club_id as string,
          name: row.club_name as string,
          logoUrl: (row.club_logo_url as string | null) ?? null,
        }
      : null,
  };
}

export type NewsPost = ReturnType<typeof mapNews>;

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly clubsService: ClubsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDefaultDurationDays(): Promise<number> {
    return (await this.getSettings()).defaultDurationDays;
  }

  async getSettings(): Promise<NewsSettings> {
    const entries = Object.entries(NEWS_SETTINGS) as [
      NewsSettingKey,
      (typeof NEWS_SETTINGS)[NewsSettingKey],
    ][];
    const result = await this.db.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM platform_settings WHERE key = ANY($1::text[])`,
      [entries.map(([, def]) => def.key)],
    );
    const stored = new Map(result.rows.map((row) => [row.key, Number(row.value)]));

    const settings = {} as NewsSettings;
    for (const [name, def] of entries) {
      const value = stored.get(def.key);
      settings[name] =
        value !== undefined && Number.isInteger(value) && value >= def.min && value <= def.max
          ? value
          : def.fallback;
    }
    return settings;
  }

  async updateSettings(changes: Partial<NewsSettings>, adminUserId: string) {
    for (const name of Object.keys(NEWS_SETTINGS) as NewsSettingKey[]) {
      const value = changes[name];
      if (value === undefined) continue;
      await this.db.query(
        `INSERT INTO platform_settings (key, value, updated_by_user_id, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_by_user_id = EXCLUDED.updated_by_user_id,
               updated_at = NOW()`,
        [NEWS_SETTINGS[name].key, JSON.stringify(value), adminUserId],
      );
    }
    return this.getSettings();
  }

  /** Carrusel del home: solo las vigentes que el backoffice marcó como destacadas. */
  async listFeatured() {
    const result = await this.db.query(
      `${NEWS_SELECT}
       WHERE ${LIVE_WHERE} AND n.is_featured = TRUE
       ORDER BY n.featured_at DESC NULLS LAST, n.published_at DESC
       LIMIT $1`,
      [FEATURED_FEED_LIMIT],
    );
    return result.rows.map(mapNews);
  }

  /** Pantalla de Novedades: todas las vigentes, con filtros. */
  async listPublic(params: {
    q?: string;
    source?: string;
    featured?: boolean;
    clubId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const offset = Math.max(params.offset ?? 0, 0);
    const values: unknown[] = [];
    const filters: string[] = [LIVE_WHERE];

    if (isNewsSource(params.source)) {
      values.push(params.source);
      filters.push(`n.source = $${values.length}`);
    }
    if (params.featured) filters.push(`n.is_featured = TRUE`);
    if (params.clubId && /^[0-9a-f-]{36}$/i.test(params.clubId)) {
      values.push(params.clubId);
      filters.push(`n.club_id = $${values.length}`);
    }
    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      const p = `$${values.length}`;
      filters.push(`(n.title ILIKE ${p} OR n.body ILIKE ${p} OR au.name ILIKE ${p} OR c.name ILIKE ${p})`);
    }

    const where = `WHERE ${filters.join(' AND ')}`;
    const countValues = [...values];
    values.push(limit, offset);

    const [rows, count] = await Promise.all([
      this.db.query(
        `${NEWS_SELECT}
         ${where}
         ORDER BY n.published_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM news_posts n
         INNER JOIN users au ON au.id = n.author_user_id
         LEFT JOIN clubs c ON c.id = n.club_id
         ${where}`,
        countValues,
      ),
    ]);

    return {
      items: rows.rows.map(mapNews),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  /** Las noticias vigentes son públicas; el resto solo las ve su autor o un admin del club. */
  async getForViewer(id: string, viewerId?: string) {
    const post = await this.findById(id);
    if (!post || post.status === 'DELETED') throw new NotFoundException('Noticia no encontrada');
    if (post.isLive) return post;
    if (viewerId && (await this.canManage(post, viewerId))) return post;
    throw new NotFoundException('Esta noticia ya no está disponible');
  }

  async listMine(userId: string) {
    const result = await this.db.query(
      `${NEWS_SELECT}
       WHERE n.author_user_id = $1 AND n.source = 'PLAYER' AND n.status <> 'DELETED'
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return result.rows.map(mapNews);
  }

  async createPlayerPost(userId: string, dto: CreateNewsPostDto, file: Express.Multer.File) {
    const pending = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM news_posts
       WHERE author_user_id = $1 AND source = 'PLAYER' AND status = 'PENDING'`,
      [userId],
    );
    const { maxPendingPerPlayer, defaultDurationDays: durationDays } = await this.getSettings();
    if (Number(pending.rows[0]?.count ?? 0) >= maxPendingPerPlayer) {
      throw new BadRequestException(
        maxPendingPerPlayer === 1
          ? 'Ya tenés una noticia esperando aprobación. Esperá a que la revisemos.'
          : `Ya tenés ${maxPendingPerPlayer} noticias esperando aprobación. Esperá a que las revisemos.`,
      );
    }

    const upload = await this.uploadImage(file, `users/${userId}`);
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO news_posts
         (author_user_id, source, title, body, link_url, image_url, cloudinary_public_id, status, duration_days)
       VALUES ($1, 'PLAYER', $2, $3, $4, $5, $6, 'PENDING', $7)
       RETURNING id`,
      [
        userId,
        dto.title,
        dto.body ?? null,
        dto.linkUrl ?? null,
        upload.secure_url,
        upload.public_id ?? null,
        durationDays,
      ],
    );
    return this.findById(result.rows[0].id);
  }

  /** Noticia oficial del backoffice: se publica al instante, sin moderación. */
  async createPlatformPost(
    adminUserId: string,
    dto: CreateNewsPostDto,
    file: Express.Multer.File,
    options: { durationDays?: number; featured?: boolean },
  ) {
    const upload = await this.uploadImage(file, 'platform');
    const durationDays = options.durationDays ?? (await this.getDefaultDurationDays());
    const featured = options.featured ?? false;
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO news_posts
         (author_user_id, source, title, body, link_url, image_url, cloudinary_public_id,
          status, duration_days, published_at, expires_at, is_featured, featured_at,
          reviewed_by_user_id, reviewed_at)
       VALUES ($1, 'PLATFORM', $2, $3, $4, $5, $6,
               'APPROVED', $7, NOW(), NOW() + make_interval(days => $7), $8,
               CASE WHEN $8 THEN NOW() ELSE NULL END, $1, NOW())
       RETURNING id`,
      [
        adminUserId,
        dto.title,
        dto.body ?? null,
        dto.linkUrl ?? null,
        upload.secure_url,
        upload.public_id ?? null,
        durationDays,
        featured,
      ],
    );
    return this.findById(result.rows[0].id);
  }

  async listForClub(clubId: string, userId: string) {
    await this.clubsService.requireClubAdmin(clubId, userId);
    const result = await this.db.query(
      `${NEWS_SELECT}
       WHERE n.club_id = $1 AND n.source = 'CLUB' AND n.status <> 'DELETED'
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [clubId],
    );
    return result.rows.map(mapNews);
  }

  async createClubPost(
    clubId: string,
    userId: string,
    dto: CreateNewsPostDto,
    file: Express.Multer.File,
  ) {
    await this.clubsService.requireClubAdmin(clubId, userId);

    const live = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM news_posts
       WHERE club_id = $1 AND status = 'APPROVED' AND expires_at > NOW()`,
      [clubId],
    );
    const { maxLivePerClub, defaultDurationDays: durationDays } = await this.getSettings();
    if (Number(live.rows[0]?.count ?? 0) >= maxLivePerClub) {
      throw new BadRequestException(
        maxLivePerClub === 1
          ? 'Tu club ya tiene una noticia vigente. Eliminala para publicar otra.'
          : `Tu club ya tiene ${maxLivePerClub} noticias vigentes. Eliminá alguna para publicar otra.`,
      );
    }

    const upload = await this.uploadImage(file, `clubs/${clubId}`);
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO news_posts
         (author_user_id, club_id, source, title, body, link_url, image_url, cloudinary_public_id,
          status, duration_days, published_at, expires_at)
       VALUES ($1, $2, 'CLUB', $3, $4, $5, $6, $7,
               'APPROVED', $8, NOW(), NOW() + make_interval(days => $8))
       RETURNING id`,
      [
        userId,
        clubId,
        dto.title,
        dto.body ?? null,
        dto.linkUrl ?? null,
        upload.secure_url,
        upload.public_id ?? null,
        durationDays,
      ],
    );
    return this.findById(result.rows[0].id);
  }

  async deleteByOwner(id: string, userId: string) {
    const post = await this.findById(id);
    if (!post || post.status === 'DELETED') throw new NotFoundException('Noticia no encontrada');
    if (!(await this.canManage(post, userId))) {
      throw new ForbiddenException('No podés eliminar esta noticia');
    }
    await this.markDeleted(id);
    return { ok: true };
  }

  async adminList(params: {
    q?: string;
    status?: string;
    source?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;
    const values: unknown[] = [];
    const filters: string[] = [];

    switch (params.status as NewsAdminStatusFilter | undefined) {
      case 'PENDING':
      case 'REJECTED':
      case 'DELETED':
        values.push(params.status);
        filters.push(`n.status = $${values.length}`);
        break;
      case 'ACTIVE':
        filters.push(`n.status = 'APPROVED' AND n.expires_at > NOW()`);
        break;
      case 'EXPIRED':
        filters.push(`n.status = 'APPROVED' AND n.expires_at <= NOW()`);
        break;
      default:
        filters.push(`n.status <> 'DELETED'`);
    }

    if (isNewsSource(params.source)) {
      values.push(params.source);
      filters.push(`n.source = $${values.length}`);
    }

    if (params.featured) filters.push(`n.is_featured = TRUE`);

    if (params.q?.trim()) {
      values.push(`%${params.q.trim()}%`);
      const p = `$${values.length}`;
      filters.push(`(n.title ILIKE ${p} OR au.name ILIKE ${p} OR c.name ILIKE ${p})`);
    }

    const where = `WHERE ${filters.join(' AND ')}`;
    const countValues = [...values];
    values.push(limit, offset);

    const [rows, count, pending] = await Promise.all([
      this.db.query(
        `${NEWS_SELECT}
         ${where}
         ORDER BY n.created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM news_posts n
         INNER JOIN users au ON au.id = n.author_user_id
         LEFT JOIN clubs c ON c.id = n.club_id
         ${where}`,
        countValues,
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM news_posts WHERE status = 'PENDING'`,
      ),
    ]);

    return {
      items: rows.rows.map(mapNews),
      total: Number(count.rows[0]?.count ?? 0),
      pendingTotal: Number(pending.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async approve(
    id: string,
    adminUserId: string,
    params: { durationDays?: number; featured?: boolean } = {},
  ) {
    const post = await this.requirePost(id);
    if (post.status !== 'PENDING' && post.status !== 'REJECTED') {
      throw new BadRequestException('Solo se pueden aprobar noticias pendientes o rechazadas');
    }
    const days = params.durationDays ?? (await this.getDefaultDurationDays());
    const featured = params.featured ?? post.isFeatured;
    await this.db.query(
      `UPDATE news_posts
       SET status = 'APPROVED',
           duration_days = $2,
           published_at = NOW(),
           expires_at = NOW() + make_interval(days => $2),
           is_featured = $4,
           featured_at = CASE WHEN $4 THEN COALESCE(featured_at, NOW()) ELSE NULL END,
           reviewed_by_user_id = $3,
           reviewed_at = NOW(),
           review_notes = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id, days, adminUserId, featured],
    );

    if (post.source === 'PLAYER') {
      await this.notify(post.author.id, 'NEWS_APPROVED', {
        title: '¡Tu noticia fue aprobada!',
        body: `"${post.title}" ya se ve en Novedades durante ${days} día${days === 1 ? '' : 's'}.`,
        newsId: id,
      });
    }
    return this.findById(id);
  }

  async setFeatured(id: string, featured: boolean) {
    const post = await this.requirePost(id);
    if (featured && post.status !== 'APPROVED' && post.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden destacar noticias aprobadas o pendientes');
    }
    await this.db.query(
      `UPDATE news_posts
       SET is_featured = $2,
           featured_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1`,
      [id, featured],
    );
    return this.findById(id);
  }

  async reject(id: string, adminUserId: string, notes?: string) {
    const post = await this.requirePost(id);
    if (post.status === 'DELETED') throw new BadRequestException('La noticia fue eliminada');
    await this.db.query(
      `UPDATE news_posts
       SET status = 'REJECTED',
           published_at = NULL,
           expires_at = NULL,
           is_featured = FALSE,
           featured_at = NULL,
           reviewed_by_user_id = $2,
           reviewed_at = NOW(),
           review_notes = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [id, adminUserId, notes?.trim() || null],
    );

    if (post.source === 'PLAYER') {
      await this.notify(post.author.id, 'NEWS_REJECTED', {
        title: 'Tu noticia no fue aprobada',
        body: notes?.trim()
          ? `"${post.title}": ${notes.trim()}`
          : `"${post.title}" no cumple con las pautas de publicación.`,
        newsId: id,
      });
    }
    return this.findById(id);
  }

  async updateExpiry(id: string, params: { expiresAt?: string; durationDays?: number }) {
    const post = await this.requirePost(id);
    if (post.status !== 'APPROVED') {
      throw new BadRequestException('Solo se puede cambiar la vigencia de noticias aprobadas');
    }

    if (params.expiresAt) {
      const expiresAt = new Date(params.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) throw new BadRequestException('Fecha inválida');
      await this.db.query(
        `UPDATE news_posts
         SET expires_at = $2,
             duration_days = LEAST(GREATEST(CEIL(EXTRACT(EPOCH FROM ($2::timestamptz - published_at)) / 86400)::int, 1), ${NEWS_MAX_DURATION_DAYS}),
             updated_at = NOW()
         WHERE id = $1`,
        [id, expiresAt.toISOString()],
      );
    } else if (params.durationDays) {
      await this.db.query(
        `UPDATE news_posts
         SET duration_days = $2,
             expires_at = published_at + make_interval(days => $2),
             updated_at = NOW()
         WHERE id = $1`,
        [id, params.durationDays],
      );
    } else {
      throw new BadRequestException('Indicá una fecha de vencimiento o una duración en días');
    }
    return this.findById(id);
  }

  async adminUpdate(
    id: string,
    dto: { title?: string; body?: string; linkUrl?: string },
    file?: Express.Multer.File,
  ) {
    const post = await this.requirePost(id);
    if (post.status === 'DELETED') throw new BadRequestException('La noticia fue eliminada');

    const linkUrl = dto.linkUrl?.trim();
    if (linkUrl && !/^https?:\/\/\S+$/i.test(linkUrl)) {
      throw new BadRequestException('El link debe empezar con http:// o https://');
    }

    const upload = file ? await this.uploadImage(file, post.club ? `clubs/${post.club.id}` : 'platform') : null;

    await this.db.query(
      `UPDATE news_posts
       SET title = COALESCE($2, title),
           body = CASE WHEN $3::boolean THEN NULLIF($4, '') ELSE body END,
           link_url = CASE WHEN $5::boolean THEN NULLIF($6, '') ELSE link_url END,
           image_url = COALESCE($7, image_url),
           cloudinary_public_id = COALESCE($8, cloudinary_public_id),
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        dto.title ?? null,
        dto.body !== undefined,
        dto.body?.trim() ?? '',
        dto.linkUrl !== undefined,
        linkUrl ?? '',
        upload?.secure_url ?? null,
        upload?.public_id ?? null,
      ],
    );
    return this.findById(id);
  }

  async adminDelete(id: string) {
    await this.requirePost(id);
    await this.markDeleted(id);
    return { ok: true };
  }

  private async findById(id: string): Promise<NewsPost | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const result = await this.db.query(`${NEWS_SELECT} WHERE n.id = $1`, [id]);
    return result.rows[0] ? mapNews(result.rows[0]) : null;
  }

  private async requirePost(id: string): Promise<NewsPost> {
    const post = await this.findById(id);
    if (!post) throw new NotFoundException('Noticia no encontrada');
    return post;
  }

  private async canManage(post: NewsPost, userId: string): Promise<boolean> {
    if (post.author.id === userId) return true;
    if (post.club) {
      try {
        await this.clubsService.assertClubAdminOf(post.club.id, userId);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private async markDeleted(id: string) {
    await this.db.query(
      `UPDATE news_posts
       SET status = 'DELETED', is_featured = FALSE, featured_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  }

  private async uploadImage(file: Express.Multer.File, folder: string) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado. Usá JPG, PNG o WEBP.');
    }
    return uploadImageBuffer(file, `playtomic-clone/news/${folder}`, { width: 1200, height: 525 });
  }

  private async notify(
    userId: string,
    type: string,
    payload: { title: string; body: string; newsId: string },
  ) {
    try {
      await this.notificationsService.create({
        userId,
        type,
        title: payload.title,
        body: payload.body,
        data: { newsId: payload.newsId },
      });
    } catch (error) {
      this.logger.warn(`No se pudo notificar ${type}: ${(error as Error).message}`);
    }
  }
}
