import type { UserRole } from './roles';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  photo?: string;
  nickname?: string;
  phone?: string;
};

export type MineSponsor = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contact_email?: string | null;
  contactPhone?: string | null;
  contact_phone?: string | null;
  websiteUrl?: string | null;
  website_url?: string | null;
  customDomain?: string | null;
  custom_domain?: string | null;
  catalog_mode?: 'NATIVE' | 'EXTERNAL_LINK' | null;
  external_store_url?: string | null;
  store_url?: string | null;
};

/** Tienda pública del partner: su propio sitio si usa catálogo externo, si no la de x4. */
export function sponsorStoreHref(
  sponsor: Pick<MineSponsor, 'slug' | 'catalog_mode' | 'store_url' | 'external_store_url' | 'website_url'>,
) {
  if (sponsor.catalog_mode === 'EXTERNAL_LINK') {
    const external = sponsor.store_url || sponsor.external_store_url || sponsor.website_url;
    if (external) return { href: external, external: true };
  }
  return { href: `/${sponsor.slug}`, external: false };
}

export type StorefrontSponsor = {
  id: string;
  name: string;
  slug: string;
  catalog_mode?: 'NATIVE' | 'EXTERNAL_LINK' | null;
  external_store_url?: string | null;
  website_url?: string | null;
  store_url?: string | null;
  logoUrl?: string | null;
  logo_url?: string | null;
  coverUrl?: string | null;
  cover_url?: string | null;
  banner_url?: string | null;
  tagline?: string | null;
  home_intro?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contact_email?: string | null;
  contactPhone?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  contact_address?: string | null;
  primaryColor?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  favicon_url?: string | null;
  store_theme?: import('./store-theme').StoreTheme | null;
  free_shipping_threshold?: number | null;
  payment_options?: {
    mpEnabled: boolean;
    whatsappEnabled: boolean;
    whatsappPhone?: string | null;
  };
};

export type StorefrontProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  compareAtPrice?: number | null;
  compare_at_price?: number | null;
  imageUrl?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  images?: string[];
  categoryId?: string | null;
  category_id?: string | null;
  stock?: number | null;
  stock_quantity?: number | null;
  featured?: boolean | null;
  is_new?: boolean | null;
  currency?: string;
};

export const LOW_STOCK_THRESHOLD = 5;

export type ProductFlags = {
  discountPercent: number;
  compareAtPrice: number | null;
  featured: boolean;
  isNew: boolean;
  soldOut: boolean;
  /** Unidades restantes cuando queda poco stock; null si no aplica. */
  lowStockLeft: number | null;
};

export function productFlags(product: StorefrontProduct): ProductFlags {
  const price = Number(product.price);
  const compare = Number(product.compare_at_price ?? product.compareAtPrice ?? 0);
  const hasDeal = compare > price && price >= 0;
  const rawStock = product.stock_quantity ?? product.stock;
  const stock = rawStock == null ? null : Number(rawStock);
  return {
    discountPercent: hasDeal ? Math.round(((compare - price) / compare) * 100) : 0,
    compareAtPrice: hasDeal ? compare : null,
    featured: Boolean(product.featured),
    isNew: Boolean(product.is_new),
    soldOut: stock != null && stock <= 0,
    lowStockLeft: stock != null && stock > 0 && stock <= LOW_STOCK_THRESHOLD ? stock : null,
  };
}

export type StorefrontCategory = {
  id: string;
  name: string;
  slug?: string;
};

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

export type StorefrontOrder = {
  id: string;
  status?: string;
  total?: number;
  currency?: string;
  checkoutUrl?: string | null;
  whatsappUrl?: string | null;
  orderId?: string;
  items?: Array<{
    productId?: string;
    name?: string;
    quantity: number;
    price?: number;
  }>;
  createdAt?: string;
};

export type StorefrontCustomer = {
  id: string;
  email: string;
  name: string;
};

export function sponsorLogoUrl(
  sponsor?: Pick<MineSponsor | StorefrontSponsor, 'logoUrl' | 'logo_url'> | null,
): string | null {
  return sponsor?.logoUrl ?? sponsor?.logo_url ?? null;
}

export function productImageUrl(
  product?: Pick<StorefrontProduct, 'imageUrl' | 'image_url' | 'photo_url' | 'images'> | null,
): string | null {
  return (
    product?.imageUrl ?? product?.image_url ?? product?.photo_url ?? product?.images?.[0] ?? null
  );
}

export function formatMoney(amount: number, currency = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString('es-AR')}`;
  }
}
