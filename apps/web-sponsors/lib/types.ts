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
};

export type StorefrontSponsor = {
  id: string;
  name: string;
  slug: string;
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
  images?: string[];
  categoryId?: string | null;
  category_id?: string | null;
  stock?: number | null;
  currency?: string;
};

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
  product?: Pick<StorefrontProduct, 'imageUrl' | 'image_url' | 'images'> | null,
): string | null {
  return product?.imageUrl ?? product?.image_url ?? product?.images?.[0] ?? null;
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
