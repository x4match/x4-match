export type NormalizedExternalProduct = {
  externalId: string;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  photoUrl: string | null;
  stockQuantity: number | null;
  category: string;
  categorySlug: string | null;
  externalUrl: string;
  published: boolean;
};

export type ExternalCategory = {
  slug: string;
  name: string;
  url: string;
};

const PRODUCT_PATH_RE = /\/productos\/([^/?#]+)\/?/i;
const PAGE_PATH_RE = /\/productos\/page\/(\d+)\/?/i;
const NON_CATEGORY_SEGMENTS = new Set([
  'productos',
  'produtos',
  'account',
  'contacto',
  'search',
  'cart',
  'checkout',
  'comprar',
  'carrito',
]);

export function normalizeStoreBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Falta la URL de la tienda');
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`URL de tienda inválida: "${trimmed}"`);
  }
  if (!url.hostname.includes('.')) {
    throw new Error(`URL de tienda inválida: "${trimmed}"`);
  }
  url.hash = '';
  url.search = '';
  // Si pegan /productos o una URL de producto, nos quedamos con el origen de la tienda.
  if (/^\/productos(\/|$)/i.test(url.pathname) || /^\/produtos(\/|$)/i.test(url.pathname)) {
    url.pathname = '';
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '';
  return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
}

export function withX4AffiliateParams(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'x4match');
    if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'app');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function extractProductHandle(productUrl: string): string | null {
  try {
    const path = new URL(productUrl).pathname;
    if (PAGE_PATH_RE.test(path)) return null;
    const match = path.match(PRODUCT_PATH_RE);
    const handle = match?.[1]?.trim();
    if (!handle || handle.toLowerCase() === 'page') return null;
    return handle;
  } catch {
    return null;
  }
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function slugifyCategory(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Slug estable a partir de la URL de categoría (`/indumentaria/remeras/` → `indumentaria-remeras`). */
export function categorySlugFromUrl(categoryUrl: string, storeBaseUrl: string): string | null {
  try {
    const url = new URL(categoryUrl, storeBaseUrl);
    const base = new URL(storeBaseUrl);
    if (url.host !== base.host) return null;
    const basePath = base.pathname.replace(/\/+$/, '');
    const path = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : url.pathname;
    const segments = path.split('/').filter(Boolean);
    if (!segments.length || NON_CATEGORY_SEGMENTS.has(segments[0].toLowerCase())) return null;
    if (segments.includes('page')) return null;
    return slugifyCategory(segments.join('-')) || null;
  } catch {
    return null;
  }
}

/**
 * Detecta las categorías publicadas en el storefront de Tienda Nube.
 * Usa el filtro "Categorías" del listado (`<a href title>`) y, si no está, los ítems del menú.
 */
export function extractStorefrontCategories(html: string, storeBaseUrl: string): ExternalCategory[] {
  const bySlug = new Map<string, ExternalCategory>();
  const add = (href: string, rawName: string) => {
    const name = decodeEntities(rawName).replace(/\s+/g, ' ').trim();
    if (!name || /^ver (toda|todos)/i.test(name)) return;
    const slug = categorySlugFromUrl(href, storeBaseUrl);
    if (!slug || bySlug.has(slug)) return;
    const url = new URL(href, storeBaseUrl);
    url.search = '';
    url.hash = '';
    bySlug.set(slug, { slug, name: name.slice(0, 60), url: url.toString() });
  };

  for (const m of html.matchAll(
    /<li[^>]*data-item="\d+"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"/gi,
  )) {
    add(m[1], m[2]);
  }

  if (!bySlug.size) {
    for (const m of html.matchAll(
      /<li[^>]*data-component="menu\.item"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      add(m[1], m[2].replace(/<[^>]+>/g, ' '));
    }
  }

  return Array.from(bySlug.values());
}

/** Detecta si hay más páginas en un listado (`/productos/` o una categoría). */
export function detectListingNextPage(html: string, listingUrl: string, currentPage: number): number | null {
  let path: string;
  try {
    path = new URL(listingUrl).pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}/page/(\\d+)/?`, 'gi');
  const pages = Array.from(html.matchAll(re)).map((m) => Number(m[1]));
  const maxPage = pages.length ? Math.max(...pages) : currentPage;
  return maxPage > currentPage ? currentPage + 1 : null;
}

function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

function pickLocalized(
  value: string | Record<string, string> | null | undefined,
  preferred = ['es', 'es_AR', 'es_MX', 'pt', 'en'],
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  for (const key of preferred) {
    const hit = value[key]?.trim();
    if (hit) return hit;
  }
  for (const v of Object.values(value)) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || !images.length) return null;
  const first = images[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const src =
      (first as { src?: string }).src ||
      (first as { url?: string }).url ||
      (first as { image?: string }).image;
    return typeof src === 'string' ? src : null;
  }
  return null;
}

function parseMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function availabilityToStock(availability: unknown, inventoryLevel?: unknown): number | null {
  if (inventoryLevel && typeof inventoryLevel === 'object') {
    const raw = (inventoryLevel as { value?: unknown }).value;
    const n = parseMoney(raw);
    if (n != null) return Math.floor(n);
  }
  if (typeof availability === 'string') {
    if (/OutOfStock|SoldOut|Discontinued/i.test(availability)) return 0;
    if (/InStock|LimitedAvailability|PreOrder/i.test(availability)) return null;
  }
  return null;
}

/** Extrae productos Product de bloques JSON-LD embebidos en HTML de Tienda Nube. */
export function parseJsonLdProductsFromHtml(html: string, storeBaseUrl: string): NormalizedExternalProduct[] {
  const blocks = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!blocks?.length) return [];

  const byId = new Map<string, NormalizedExternalProduct>();
  for (const block of blocks) {
    const inner = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>\s*$/i, '').trim();
    if (!inner) continue;
    let data: unknown;
    try {
      data = JSON.parse(inner);
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      const normalized = normalizeJsonLdProduct(item, storeBaseUrl);
      if (!normalized) continue;
      byId.set(normalized.externalId, normalized);
    }
  }
  return Array.from(byId.values());
}

function normalizeJsonLdProduct(item: unknown, storeBaseUrl: string): NormalizedExternalProduct | null {
  if (!item || typeof item !== 'object') return null;
  const node = item as Record<string, any>;
  const type = node['@type'];
  const isProduct =
    type === 'Product' || (Array.isArray(type) && type.includes('Product'));
  if (!isProduct) return null;

  const offerRaw = Array.isArray(node.offers) ? node.offers[0] : node.offers;
  const offer = offerRaw && typeof offerRaw === 'object' ? (offerRaw as Record<string, any>) : {};
  const url =
    (typeof offer.url === 'string' && offer.url) ||
    (typeof node.url === 'string' && node.url) ||
    (typeof node.mainEntityOfPage?.['@id'] === 'string' && node.mainEntityOfPage['@id']) ||
    null;
  if (!url) return null;

  const handle = extractProductHandle(url);
  const sku = typeof node.sku === 'string' ? node.sku.trim() : null;
  const externalId = sku || handle;
  if (!externalId) return null;

  const price = parseMoney(offer.price ?? offer.lowPrice ?? node.price);
  if (price == null) return null;

  const image =
    typeof node.image === 'string'
      ? node.image
      : Array.isArray(node.image)
        ? typeof node.image[0] === 'string'
          ? node.image[0]
          : node.image[0]?.url || null
        : node.image?.url || null;

  const absoluteUrl = url.startsWith('http')
    ? url
    : `${storeBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;

  return {
    externalId,
    name: String(node.name || handle || 'Producto').trim(),
    description: stripHtml(typeof node.description === 'string' ? node.description : null),
    price,
    compareAtPrice: null,
    currency: String(offer.priceCurrency || 'ARS').toUpperCase().slice(0, 3),
    photoUrl: image,
    stockQuantity: availabilityToStock(offer.availability, offer.inventoryLevel),
    category: 'MERCH',
    categorySlug: null,
    externalUrl: absoluteUrl.replace(/\/?$/, '/'),
    // Incluimos agotados para que la app los muestre como sin stock.
    published: true,
  };
}

/** Detecta si hay más páginas en el listado `/productos/`. */
export function detectProductListingNextPage(html: string, currentPage: number): number | null {
  const pages = Array.from(html.matchAll(/\/productos\/page\/(\d+)\/?/gi)).map((m) =>
    Number(m[1]),
  );
  const maxPage = pages.length ? Math.max(...pages) : currentPage;
  if (maxPage > currentPage) return currentPage + 1;
  return null;
}

export function collectProductUrlsFromSitemap(xml: string): string[] {
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map((m) => m[1].trim());
  const urls = locs.filter((loc) => {
    try {
      const path = new URL(loc).pathname;
      return PRODUCT_PATH_RE.test(path) && !PAGE_PATH_RE.test(path);
    } catch {
      return false;
    }
  });
  return Array.from(new Set(urls));
}

type TiendaNubeApiProduct = {
  id: number | string;
  name?: string | Record<string, string>;
  description?: string | Record<string, string>;
  handle?: string | Record<string, string>;
  published?: boolean;
  images?: Array<{ src?: string; url?: string } | string>;
  categories?: Array<{
    name?: string | Record<string, string>;
    handle?: string | Record<string, string>;
  }>;
  variants?: Array<{
    price?: string | number;
    promotional_price?: string | number | null;
    stock?: number | null;
    stock_management?: boolean;
  }>;
  canonical_url?: string;
  url?: string;
};

export function mapTiendaNubeApiProduct(
  product: TiendaNubeApiProduct,
  storeBaseUrl: string,
): NormalizedExternalProduct | null {
  const name = pickLocalized(product.name);
  if (!name) return null;
  const handle = pickLocalized(product.handle);
  const variant = product.variants?.[0];
  const price = parseMoney(variant?.promotional_price ?? variant?.price ?? null);
  const compare =
    variant?.promotional_price != null && variant?.price != null
      ? parseMoney(variant.price)
      : null;
  if (price == null) return null;

  const pathHandle = handle || String(product.id);
  const externalUrl =
    product.canonical_url ||
    product.url ||
    `${storeBaseUrl}/productos/${pathHandle}/`;

  const firstCategory = product.categories?.[0];
  const realCategoryName = pickLocalized(firstCategory?.name);
  const categoryName = realCategoryName || 'MERCH';
  const categorySlug = realCategoryName
    ? slugifyCategory(pickLocalized(firstCategory?.handle) || realCategoryName) || null
    : null;
  const stock =
    variant?.stock_management === false
      ? null
      : variant?.stock == null
        ? null
        : Math.max(0, Math.floor(Number(variant.stock)));

  return {
    externalId: String(product.id),
    name,
    description: stripHtml(pickLocalized(product.description)),
    price,
    compareAtPrice: compare != null && compare > price ? compare : null,
    currency: 'ARS',
    photoUrl: firstImageUrl(product.images),
    stockQuantity: stock,
    category: categoryName.slice(0, 40),
    categorySlug,
    externalUrl: externalUrl.replace(/\/?$/, '/'),
    published: product.published !== false,
  };
}
