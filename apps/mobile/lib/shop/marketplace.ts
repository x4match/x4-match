import { api } from '@/lib/api';

export type PlatformProductRow = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  compare_at_price?: number | string | null;
  currency?: string | null;
  photo_url?: string | null;
  stock_quantity?: number | null;
  category?: string | null;
  category_name?: string | null;
  is_new?: boolean | null;
  featured?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
  sponsor_id?: string | null;
  sponsor_name?: string | null;
  sponsor_logo_url?: string | null;
  sponsor_slug?: string | null;
  sponsor_tagline?: string | null;
  sponsor_primary_color?: string | null;
  sponsor_banner_url?: string | null;
  sponsor_store_url?: string | null;
  product_url?: string | null;
};

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number;
  currency: string;
  photoUrl: string | null;
  inStock: boolean;
  lowStock: boolean;
  /** Unidades restantes cuando hay poco stock; null si no aplica. */
  stockLeft: number | null;
  category: string;
  isNew: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string | null;
  partnerId: string;
  productUrl: string | null;
};

export type ShopPartner = {
  id: string;
  name: string;
  logoUrl: string | null;
  tagline: string | null;
  color: string | null;
  bannerUrl: string | null;
  storeUrl: string | null;
};

export type ShopSort = 'relevance' | 'price_asc' | 'price_desc' | 'discount' | 'newest';

export type ShopPriceRange = 'all' | 'lt10' | '10to30' | '30to60' | 'gt60';

export type ShopFilters = {
  partnerId: string | null;
  category: string | null;
  query: string;
  sort: ShopSort;
  priceRange: ShopPriceRange;
  onlyOffers: boolean;
  onlyNew: boolean;
  onlyInStock: boolean;
};

export const DEFAULT_SHOP_FILTERS: ShopFilters = {
  partnerId: null,
  category: null,
  query: '',
  sort: 'relevance',
  priceRange: 'all',
  onlyOffers: false,
  onlyNew: false,
  onlyInStock: false,
};

export const SHOP_SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: 'relevance', label: 'Destacados' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
  { value: 'discount', label: 'Mayor descuento' },
  { value: 'newest', label: 'Novedades' },
];

export const SHOP_PRICE_RANGES: { value: ShopPriceRange; label: string; min: number; max: number }[] = [
  { value: 'all', label: 'Todos', min: 0, max: Infinity },
  { value: 'lt10', label: 'Hasta $10.000', min: 0, max: 10000 },
  { value: '10to30', label: '$10.000 – $30.000', min: 10000, max: 30000 },
  { value: '30to60', label: '$30.000 – $60.000', min: 30000, max: 60000 },
  { value: 'gt60', label: 'Más de $60.000', min: 60000, max: Infinity },
];

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  MERCH: 'Indumentaria',
  GEAR: 'Equipamiento',
};

const FALLBACK_PARTNER_ID = '__x4__';
const LOW_STOCK_THRESHOLD = 5;

function categoryLabel(row: PlatformProductRow): string {
  const named = row.category_name?.trim();
  if (named) return named;
  const code = row.category?.trim();
  if (!code) return 'Otros';
  if (LEGACY_CATEGORY_LABELS[code.toUpperCase()]) return LEGACY_CATEGORY_LABELS[code.toUpperCase()];
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}

export function normalizeShopCatalog(rows: PlatformProductRow[]): {
  products: ShopProduct[];
  partners: ShopPartner[];
} {
  const partners = new Map<string, ShopPartner>();
  const products = rows.map((row): ShopProduct => {
    const partnerId = row.sponsor_id || FALLBACK_PARTNER_ID;
    if (!partners.has(partnerId)) {
      partners.set(partnerId, {
        id: partnerId,
        name: row.sponsor_name?.trim() || 'x4 Partners',
        logoUrl: row.sponsor_logo_url || null,
        tagline: row.sponsor_tagline?.trim() || null,
        color: row.sponsor_primary_color || null,
        bannerUrl: row.sponsor_banner_url || null,
        storeUrl: row.sponsor_store_url || null,
      });
    }
    const price = Number(row.price) || 0;
    const compare = row.compare_at_price != null ? Number(row.compare_at_price) : null;
    const hasCompare = compare != null && compare > price;
    const stock = row.stock_quantity;
    return {
      id: row.id,
      name: row.name,
      description: row.description?.trim() || null,
      price,
      compareAtPrice: hasCompare ? compare : null,
      discountPercent: hasCompare ? Math.round(((compare! - price) / compare!) * 100) : 0,
      currency: row.currency || 'ARS',
      photoUrl: row.photo_url || null,
      inStock: stock == null || stock > 0,
      lowStock: stock != null && stock > 0 && stock <= LOW_STOCK_THRESHOLD,
      stockLeft: stock != null && stock > 0 && stock <= LOW_STOCK_THRESHOLD ? stock : null,
      category: categoryLabel(row),
      isNew: Boolean(row.is_new),
      featured: Boolean(row.featured),
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at ?? null,
      partnerId,
      productUrl: row.product_url || null,
    };
  });

  return { products, partners: Array.from(partners.values()) };
}

export async function fetchShopCatalog() {
  const res = await api.get('/shop/products');
  return normalizeShopCatalog((res.data || []) as PlatformProductRow[]);
}

function relevanceScore(p: ShopProduct): number {
  return (p.featured ? 4 : 0) + (p.discountPercent > 0 ? 2 : 0) + (p.isNew ? 1 : 0);
}

function sortProducts(list: ShopProduct[], sort: ShopSort): ShopProduct[] {
  const sorted = [...list];
  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'discount':
      return sorted.sort((a, b) => b.discountPercent - a.discountPercent || a.price - b.price);
    case 'newest':
      return sorted.sort(
        (a, b) =>
          Number(b.isNew) - Number(a.isNew) ||
          (b.createdAt || '').localeCompare(a.createdAt || ''),
      );
    default:
      return sorted.sort(
        (a, b) =>
          Number(b.inStock) - Number(a.inStock) ||
          relevanceScore(b) - relevanceScore(a) ||
          a.sortOrder - b.sortOrder,
      );
  }
}

export function applyShopFilters(products: ShopProduct[], filters: ShopFilters): ShopProduct[] {
  const q = filters.query.trim().toLowerCase();
  const range = SHOP_PRICE_RANGES.find((r) => r.value === filters.priceRange) ?? SHOP_PRICE_RANGES[0];
  const filtered = products.filter((p) => {
    if (filters.partnerId && p.partnerId !== filters.partnerId) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.onlyOffers && p.discountPercent <= 0) return false;
    if (filters.onlyNew && !p.isNew) return false;
    if (filters.onlyInStock && !p.inStock) return false;
    if (p.price < range.min || p.price >= range.max) return false;
    if (q) {
      const haystack = `${p.name} ${p.description ?? ''} ${p.category}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  return sortProducts(filtered, filters.sort);
}

/** Cantidad de filtros del sheet activos (no cuenta búsqueda, partner ni categoría). */
export function countSheetFilters(filters: ShopFilters): number {
  return (
    (filters.sort !== 'relevance' ? 1 : 0) +
    (filters.priceRange !== 'all' ? 1 : 0) +
    (filters.onlyOffers ? 1 : 0) +
    (filters.onlyNew ? 1 : 0) +
    (filters.onlyInStock ? 1 : 0)
  );
}

/** Productos para el carrusel principal: destacados, ofertas y novedades primero. */
export function pickHighlights(products: ShopProduct[], limit = 8): ShopProduct[] {
  const available = products.filter((p) => p.inStock);
  const pool = available.length ? available : products;
  return sortProducts(pool, 'relevance').slice(0, limit);
}

export function listCategories(products: ShopProduct[]): string[] {
  return Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b));
}
