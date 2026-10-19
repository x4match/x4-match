import { api } from '@/lib/api';
import type { Ionicons } from '@expo/vector-icons';
import type { ShopPartner, ShopProduct } from './marketplace';

export type ListingCategory =
  | 'PALETAS'
  | 'ZAPATILLAS'
  | 'INDUMENTARIA'
  | 'BOLSOS'
  | 'PELOTAS'
  | 'ACCESORIOS'
  | 'OTROS';

export type ListingCondition = 'NEW' | 'LIKE_NEW' | 'USED';

export type ListingStatus = 'ACTIVE' | 'PAUSED' | 'SOLD';

export type PlayerListingRow = {
  id: string;
  seller_user_id: string;
  title: string;
  description: string | null;
  price: number | string;
  currency: string;
  category: ListingCategory;
  condition: ListingCondition;
  city: string | null;
  photo_urls: string[] | null;
  status: ListingStatus;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
  seller_name: string;
  seller_nickname: string | null;
  seller_photo_url: string | null;
};

export type ListingInput = {
  title: string;
  description?: string;
  price: number;
  category: ListingCategory;
  condition: ListingCondition;
  city?: string;
};

export const MAX_LISTING_PHOTOS = 5;

export const LISTING_CATEGORIES: {
  value: ListingCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'PALETAS', label: 'Paletas', icon: 'tennisball-outline' },
  { value: 'ZAPATILLAS', label: 'Zapatillas', icon: 'footsteps-outline' },
  { value: 'INDUMENTARIA', label: 'Indumentaria', icon: 'shirt-outline' },
  { value: 'BOLSOS', label: 'Bolsos', icon: 'briefcase-outline' },
  { value: 'PELOTAS', label: 'Pelotas', icon: 'baseball-outline' },
  { value: 'ACCESORIOS', label: 'Accesorios', icon: 'watch-outline' },
  { value: 'OTROS', label: 'Otros', icon: 'bag-handle-outline' },
];

export const LISTING_CONDITIONS: { value: ListingCondition; label: string; hint: string }[] = [
  { value: 'NEW', label: 'Nuevo', hint: 'Sin uso, con etiqueta o en caja' },
  { value: 'LIKE_NEW', label: 'Como nuevo', hint: 'Poco uso, sin detalles' },
  { value: 'USED', label: 'Usado', hint: 'Con marcas de uso normales' },
];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  ACTIVE: 'Publicado',
  PAUSED: 'Pausado',
  SOLD: 'Vendido',
};

export function listingCategoryLabel(category: string): string {
  return LISTING_CATEGORIES.find((c) => c.value === category)?.label ?? 'Otros';
}

export function listingConditionLabel(condition: string): string {
  return LISTING_CONDITIONS.find((c) => c.value === condition)?.label ?? 'Usado';
}

export function sellerDisplayName(row: Pick<PlayerListingRow, 'seller_name' | 'seller_nickname'>): string {
  return row.seller_nickname?.trim() || row.seller_name;
}

/** Adapta la publicación al modelo del Shop x4 para reutilizar tarjetas, carrusel y filtros. */
export function listingToShopProduct(row: PlayerListingRow): ShopProduct {
  return {
    id: row.id,
    name: row.title,
    description: row.description,
    price: Number(row.price) || 0,
    compareAtPrice: null,
    discountPercent: 0,
    currency: row.currency || 'ARS',
    photoUrl: row.photo_urls?.[0] ?? null,
    inStock: row.status === 'ACTIVE',
    lowStock: false,
    category: listingCategoryLabel(row.category),
    isNew: row.condition === 'NEW',
    featured: false,
    sortOrder: 0,
    createdAt: row.created_at,
    partnerId: row.seller_user_id,
    productUrl: null,
  };
}

export function listingSeller(row: PlayerListingRow): ShopPartner {
  return {
    id: row.seller_user_id,
    name: sellerDisplayName(row),
    logoUrl: row.seller_photo_url,
    tagline: row.city,
    color: null,
    bannerUrl: null,
    storeUrl: null,
  };
}

export async function fetchMarketplaceListings() {
  const res = await api.get('/marketplace/listings');
  const rows = (res.data || []) as PlayerListingRow[];
  const sellers = new Map<string, ShopPartner>();
  for (const row of rows) {
    if (!sellers.has(row.seller_user_id)) sellers.set(row.seller_user_id, listingSeller(row));
  }
  const products = rows.map((row, index) => ({ ...listingToShopProduct(row), sortOrder: index }));
  return { rows, products, sellers };
}

export async function fetchMyListings() {
  const res = await api.get('/marketplace/listings/mine');
  return (res.data || []) as PlayerListingRow[];
}

export async function fetchListing(id: string) {
  const res = await api.get(`/marketplace/listings/${id}`);
  return res.data as PlayerListingRow;
}

export async function createListing(input: ListingInput) {
  const res = await api.post('/marketplace/listings', input);
  return res.data as PlayerListingRow;
}

export async function updateListing(id: string, input: Partial<ListingInput> & { status?: ListingStatus }) {
  const res = await api.patch(`/marketplace/listings/${id}`, input);
  return res.data as PlayerListingRow;
}

export async function deleteListing(id: string) {
  await api.delete(`/marketplace/listings/${id}`);
}

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export async function uploadListingPhoto(id: string, uri: string) {
  const ext = uri.split('.').pop()?.toLowerCase();
  const formData = new FormData();
  formData.append('photo', {
    uri,
    name: `listing.${ext && ext.length <= 4 ? ext : 'jpg'}`,
    type: guessMimeType(uri),
  } as any);
  const res = await api.post(`/marketplace/listings/${id}/photos`, formData);
  return res.data as PlayerListingRow;
}

export async function removeListingPhoto(id: string, url: string) {
  const res = await api.post(`/marketplace/listings/${id}/photos/remove`, { url });
  return res.data as PlayerListingRow;
}

export const MARKETPLACE_QUERY_KEY = ['player-marketplace'] as const;
export const MY_LISTINGS_QUERY_KEY = ['player-marketplace', 'mine'] as const;
export const listingQueryKey = (id: string) => ['player-marketplace', 'listing', id] as const;
