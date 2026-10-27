import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { decryptSecret, encryptSecret } from '../common/utils/token-crypto';
import {
  collectProductUrlsFromSitemap,
  detectListingNextPage,
  extractStorefrontCategories,
  mapTiendaNubeApiProduct,
  normalizeStoreBaseUrl,
  parseJsonLdProductsFromHtml,
  type ExternalCategory,
  type NormalizedExternalProduct,
  withX4AffiliateParams,
} from './tienda-nube-catalog.util';

const EXTERNAL_SOURCE = 'tienda_nube';
const DEFAULT_USER_AGENT = 'x4match-catalog-sync/1.0 (api@x4match.com)';
const MAX_LISTING_PAGES = 40;
const MAX_CATEGORIES = 40;
const MAX_CATEGORY_PAGES = 10;
const MAX_PRODUCTS_DEFAULT = 300;

type SponsorCatalogRow = {
  id: string;
  name: string;
  catalog_mode: 'NATIVE' | 'EXTERNAL_LINK';
  external_store_url: string | null;
  website_url: string | null;
  tienda_nube_store_id: string | null;
  tienda_nube_access_token_encrypted: string | null;
  catalog_sync_enabled: boolean;
};

@Injectable()
export class TiendaNubeCatalogService {
  private readonly logger = new Logger(TiendaNubeCatalogService.name);
  private syncing = new Set<string>();

  constructor(private readonly db: DatabaseService) {}

  affiliateUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    return withX4AffiliateParams(url);
  }

  async configureSponsor(
    sponsorId: string,
    dto: {
      catalogMode?: 'NATIVE' | 'EXTERNAL_LINK';
      externalStoreUrl?: string | null;
      tiendaNubeStoreId?: string | null;
      tiendaNubeAccessToken?: string | null;
      catalogSyncEnabled?: boolean;
      clearTiendaNubeToken?: boolean;
    },
  ) {
    const current = await this.getSponsorOrThrow(sponsorId);
    const normalizeOrBadRequest = (raw: string) => {
      try {
        return normalizeStoreBaseUrl(raw);
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'URL de tienda inválida');
      }
    };
    let externalStoreUrl = current.external_store_url;
    if (dto.externalStoreUrl !== undefined) {
      externalStoreUrl = dto.externalStoreUrl?.trim()
        ? normalizeOrBadRequest(dto.externalStoreUrl)
        : null;
    }

    let tokenEncrypted = current.tienda_nube_access_token_encrypted;
    if (dto.clearTiendaNubeToken) {
      tokenEncrypted = null;
    } else if (dto.tiendaNubeAccessToken?.trim()) {
      tokenEncrypted = encryptSecret(dto.tiendaNubeAccessToken.trim());
    }

    const catalogMode = dto.catalogMode ?? current.catalog_mode;
    if (catalogMode === 'EXTERNAL_LINK') {
      const storeUrl = externalStoreUrl || current.website_url;
      if (!storeUrl) {
        throw new BadRequestException(
          'Para catálogo externo necesitás la URL de la tienda (Tienda Nube o dominio propio)',
        );
      }
      if (!externalStoreUrl && current.website_url) {
        externalStoreUrl = normalizeOrBadRequest(current.website_url);
      }
    }

    const result = await this.db.query(
      `UPDATE platform_sponsors
       SET catalog_mode = COALESCE($2::sponsor_catalog_mode, catalog_mode),
           external_store_url = $3,
           tienda_nube_store_id = CASE
             WHEN $7::boolean THEN $4
             ELSE tienda_nube_store_id
           END,
           tienda_nube_access_token_encrypted = $5,
           catalog_sync_enabled = COALESCE($6, catalog_sync_enabled),
           catalog_sync_error = CASE
             WHEN COALESCE($2::sponsor_catalog_mode, catalog_mode) = 'NATIVE' THEN NULL
             ELSE catalog_sync_error
           END,
           website_url = COALESCE(website_url, $3),
           custom_domain = CASE
             WHEN COALESCE($2::sponsor_catalog_mode, catalog_mode) = 'EXTERNAL_LINK' THEN NULL
             ELSE custom_domain
           END,
           custom_domain_status = CASE
             WHEN COALESCE($2::sponsor_catalog_mode, catalog_mode) = 'EXTERNAL_LINK'
               THEN 'NONE'::sponsor_domain_status
             ELSE custom_domain_status
           END,
           custom_domain_verify_token = CASE
             WHEN COALESCE($2::sponsor_catalog_mode, catalog_mode) = 'EXTERNAL_LINK' THEN NULL
             ELSE custom_domain_verify_token
           END,
           custom_domain_verified_at = CASE
             WHEN COALESCE($2::sponsor_catalog_mode, catalog_mode) = 'EXTERNAL_LINK' THEN NULL
             ELSE custom_domain_verified_at
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, catalog_mode, external_store_url, tienda_nube_store_id,
                 catalog_sync_enabled, catalog_synced_at, catalog_sync_error,
                 catalog_sync_product_count,
                 (tienda_nube_access_token_encrypted IS NOT NULL) AS tienda_nube_connected`,
      [
        sponsorId,
        dto.catalogMode ?? null,
        externalStoreUrl,
        dto.tiendaNubeStoreId === undefined ? null : dto.tiendaNubeStoreId?.trim() || null,
        tokenEncrypted,
        dto.catalogSyncEnabled ?? null,
        dto.tiendaNubeStoreId !== undefined,
      ],
    );
    return result.rows[0];
  }

  async syncSponsor(sponsorId: string, options: { force?: boolean } = {}) {
    if (this.syncing.has(sponsorId)) {
      throw new BadRequestException('Ya hay una sincronización en curso para este partner');
    }
    this.syncing.add(sponsorId);
    try {
      const sponsor = await this.getSponsorOrThrow(sponsorId);
      if (sponsor.catalog_mode !== 'EXTERNAL_LINK' && !options.force) {
        throw new BadRequestException(
          'El partner no está en modo EXTERNAL_LINK. Configurá el catálogo externo primero.',
        );
      }

      const storeBase = normalizeStoreBaseUrl(
        sponsor.external_store_url || sponsor.website_url || '',
      );
      if (!storeBase) {
        throw new BadRequestException('Falta external_store_url / website_url del partner');
      }

      let products: NormalizedExternalProduct[];
      let categories: ExternalCategory[];
      let method: 'api' | 'storefront';
      if (sponsor.tienda_nube_store_id && sponsor.tienda_nube_access_token_encrypted) {
        products = await this.fetchViaApi(sponsor, storeBase);
        categories = this.categoriesFromProducts(products);
        method = 'api';
      } else {
        ({ products, categories } = await this.fetchViaStorefront(storeBase));
        method = 'storefront';
      }

      const published = products.filter((p) => p.published && p.price >= 0);
      const categoryIds = await this.upsertCategories(sponsorId, categories);
      const upserted = await this.upsertProducts(sponsorId, published, categoryIds);

      await this.db.query(
        `UPDATE platform_sponsors
         SET catalog_synced_at = NOW(),
             catalog_sync_error = NULL,
             catalog_sync_product_count = $2,
             catalog_sync_enabled = TRUE,
             catalog_mode = 'EXTERNAL_LINK'::sponsor_catalog_mode,
             external_store_url = COALESCE(external_store_url, $3),
             updated_at = NOW()
         WHERE id = $1`,
        [sponsorId, upserted, storeBase],
      );

      this.logger.log(
        `Sync Tienda Nube ${sponsor.name}: ${upserted} productos y ${categoryIds.size} categorías vía ${method}`,
      );
      return {
        ok: true,
        method,
        store_url: storeBase,
        fetched: products.length,
        upserted,
        categories: categoryIds.size,
        archived: Math.max(0, products.length - published.length),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db.query(
        `UPDATE platform_sponsors
         SET catalog_sync_error = $2, updated_at = NOW()
         WHERE id = $1`,
        [sponsorId, message.slice(0, 500)],
      );
      throw err instanceof BadRequestException || err instanceof NotFoundException
        ? err
        : new BadRequestException(`No se pudo sincronizar Tienda Nube: ${message}`);
    } finally {
      this.syncing.delete(sponsorId);
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async syncEnabledSponsors() {
    const result = await this.db.query(
      `SELECT id FROM platform_sponsors
       WHERE catalog_sync_enabled = TRUE
         AND catalog_mode = 'EXTERNAL_LINK'
         AND active = TRUE
       ORDER BY catalog_synced_at NULLS FIRST
       LIMIT 20`,
    );
    for (const row of result.rows) {
      try {
        await this.syncSponsor(row.id, { force: true });
      } catch (err) {
        this.logger.warn(
          `Sync falló para sponsor ${row.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async getSponsorOrThrow(sponsorId: string): Promise<SponsorCatalogRow> {
    const result = await this.db.query(
      `SELECT id, name, catalog_mode, external_store_url, website_url,
              tienda_nube_store_id, tienda_nube_access_token_encrypted, catalog_sync_enabled
       FROM platform_sponsors WHERE id = $1`,
      [sponsorId],
    );
    if (!result.rows[0]) throw new NotFoundException('Partner no encontrado');
    return result.rows[0];
  }

  private async fetchViaApi(
    sponsor: SponsorCatalogRow,
    storeBase: string,
  ): Promise<NormalizedExternalProduct[]> {
    const token = decryptSecret(sponsor.tienda_nube_access_token_encrypted!);
    const storeId = sponsor.tienda_nube_store_id!.trim();
    const max = Number(process.env.TIENDA_NUBE_SYNC_MAX_PRODUCTS || MAX_PRODUCTS_DEFAULT);
    const products: NormalizedExternalProduct[] = [];
    let page = 1;

    while (products.length < max) {
      const url = `https://api.tiendanube.com/v1/${storeId}/products?page=${page}&per_page=50&published=true`;
      const res = await fetch(url, {
        headers: {
          Authentication: `bearer ${token}`,
          Authorization: `bearer ${token}`,
          'User-Agent': process.env.TIENDA_NUBE_USER_AGENT || DEFAULT_USER_AGENT,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`API Tienda Nube HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const batch = (await res.json()) as unknown;
      if (!Array.isArray(batch) || batch.length === 0) break;
      for (const item of batch) {
        const mapped = mapTiendaNubeApiProduct(item, storeBase);
        if (mapped) products.push(mapped);
        if (products.length >= max) break;
      }
      if (batch.length < 50) break;
      page += 1;
      if (page > 40) break;
    }
    return products;
  }

  private categoriesFromProducts(products: NormalizedExternalProduct[]): ExternalCategory[] {
    const bySlug = new Map<string, ExternalCategory>();
    for (const p of products) {
      if (p.categorySlug && !bySlug.has(p.categorySlug)) {
        bySlug.set(p.categorySlug, { slug: p.categorySlug, name: p.category, url: '' });
      }
    }
    return Array.from(bySlug.values());
  }

  private async fetchViaStorefront(
    storeBase: string,
  ): Promise<{ products: NormalizedExternalProduct[]; categories: ExternalCategory[] }> {
    const max = Number(process.env.TIENDA_NUBE_SYNC_MAX_PRODUCTS || MAX_PRODUCTS_DEFAULT);
    const byId = new Map<string, NormalizedExternalProduct>();
    let firstListingHtml = '';

    // 1) Listados /productos/ (JSON-LD Product embebido por página)
    const listingBase = `${storeBase}/productos/`;
    let page = 1;
    while (page <= MAX_LISTING_PAGES && byId.size < max) {
      const listUrl = page === 1 ? listingBase : `${storeBase}/productos/page/${page}/`;
      const html = await this.fetchText(listUrl);
      if (page === 1) firstListingHtml = html;
      const parsed = parseJsonLdProductsFromHtml(html, storeBase);
      for (const p of parsed) {
        byId.set(p.externalId, p);
        if (byId.size >= max) break;
      }
      const next = detectListingNextPage(html, listingBase, page);
      if (!next || parsed.length === 0) break;
      page = next;
    }

    // 2) Si el listado vino vacío, intentar sitemap + páginas de producto
    if (byId.size === 0) {
      const sitemapXml = await this.fetchText(`${storeBase}/sitemap.xml`).catch(() => '');
      const urls = collectProductUrlsFromSitemap(sitemapXml).slice(0, max);
      for (const productUrl of urls) {
        try {
          const html = await this.fetchText(productUrl);
          const parsed = parseJsonLdProductsFromHtml(html, storeBase);
          for (const p of parsed) byId.set(p.externalId, p);
        } catch {
          // seguir con el resto
        }
        if (byId.size >= max) break;
      }
    }

    if (byId.size === 0) {
      throw new Error(
        'No se encontraron productos públicos. Pedile al partner un access token de Tienda Nube (lectura de productos) o verificá que /productos/ esté publicado.',
      );
    }

    // 3) Categorías: recorrer cada listado de categoría y asignar sus productos
    const categories = extractStorefrontCategories(firstListingHtml, storeBase).slice(
      0,
      MAX_CATEGORIES,
    );
    const found: ExternalCategory[] = [];
    for (const category of categories) {
      let matched = 0;
      let catPage = 1;
      try {
        while (catPage <= MAX_CATEGORY_PAGES) {
          const base = category.url.replace(/\/?$/, '/');
          const url = catPage === 1 ? base : `${base}page/${catPage}/`;
          const html = await this.fetchText(url);
          const parsed = parseJsonLdProductsFromHtml(html, storeBase);
          for (const p of parsed) {
            const product = byId.get(p.externalId);
            if (product && !product.categorySlug) {
              product.categorySlug = category.slug;
              product.category = category.name.slice(0, 40);
              matched += 1;
            }
          }
          const next = detectListingNextPage(html, base, catPage);
          if (!next || parsed.length === 0) break;
          catPage = next;
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo leer la categoría ${category.url}: ${err instanceof Error ? err.message : err}`,
        );
      }
      if (matched > 0) found.push(category);
    }

    return { products: Array.from(byId.values()), categories: found };
  }

  /** Crea/actualiza las categorías del partner y devuelve slug → id. */
  private async upsertCategories(
    sponsorId: string,
    categories: ExternalCategory[],
  ): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const [index, category] of categories.entries()) {
      const result = await this.db.query(
        `INSERT INTO platform_sponsor_categories (sponsor_id, name, slug, sort_order, active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (sponsor_id, slug)
         DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
                       active = TRUE, updated_at = NOW()
         RETURNING id`,
        [sponsorId, category.name, category.slug, index],
      );
      ids.set(category.slug, result.rows[0].id);
    }
    return ids;
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': process.env.TIENDA_NUBE_USER_AGENT || DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al pedir ${url}`);
    }
    return res.text();
  }

  private async upsertProducts(
    sponsorId: string,
    products: NormalizedExternalProduct[],
    categoryIds: Map<string, string>,
  ) {
    const seenExternalIds: string[] = [];
    let upserted = 0;

    for (const [index, product] of products.entries()) {
      seenExternalIds.push(product.externalId);
      const categoryId = product.categorySlug ? categoryIds.get(product.categorySlug) ?? null : null;
      const existing = await this.db.query(
        `SELECT id FROM platform_products
         WHERE sponsor_id = $1 AND external_source = $2 AND external_id = $3
         LIMIT 1`,
        [sponsorId, EXTERNAL_SOURCE, product.externalId],
      );

      if (existing.rows[0]) {
        await this.db.query(
          `UPDATE platform_products
           SET name = $2,
               description = $3,
               price = $4,
               compare_at_price = $5,
               currency = $6,
               photo_url = COALESCE($7, photo_url),
               stock_quantity = $8,
               category = $9,
               status = 'ACTIVE'::platform_product_status,
               sort_order = $10,
               external_url = $11,
               category_id = COALESCE($12, category_id),
               updated_at = NOW()
           WHERE id = $1`,
          [
            existing.rows[0].id,
            product.name.slice(0, 200),
            product.description,
            product.price,
            product.compareAtPrice,
            product.currency,
            product.photoUrl,
            product.stockQuantity,
            product.category.slice(0, 40),
            index,
            product.externalUrl,
            categoryId,
          ],
        );
      } else {
        await this.db.query(
          `INSERT INTO platform_products
             (sponsor_id, name, description, price, compare_at_price, currency, photo_url,
              stock_quantity, category, status, sort_order, external_source, external_id,
              external_url, category_id, is_new, featured)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE'::platform_product_status,$10,$11,$12,$13,$14,FALSE,FALSE)`,
          [
            sponsorId,
            product.name.slice(0, 200),
            product.description,
            product.price,
            product.compareAtPrice,
            product.currency,
            product.photoUrl,
            product.stockQuantity,
            product.category.slice(0, 40),
            index,
            EXTERNAL_SOURCE,
            product.externalId,
            product.externalUrl,
            categoryId,
          ],
        );
      }
      upserted += 1;
    }

    if (seenExternalIds.length) {
      await this.db.query(
        `UPDATE platform_products
         SET status = 'ARCHIVED'::platform_product_status, updated_at = NOW()
         WHERE sponsor_id = $1
           AND external_source = $2
           AND status = 'ACTIVE'
           AND NOT (external_id = ANY($3::text[]))`,
        [sponsorId, EXTERNAL_SOURCE, seenExternalIds],
      );
    } else {
      await this.db.query(
        `UPDATE platform_products
         SET status = 'ARCHIVED'::platform_product_status, updated_at = NOW()
         WHERE sponsor_id = $1 AND external_source = $2 AND status = 'ACTIVE'`,
        [sponsorId, EXTERNAL_SOURCE],
      );
    }

    return upserted;
  }
}
