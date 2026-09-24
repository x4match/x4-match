import { api } from './api';
import type { CheckoutPayload, ShippingQuote } from './checkout-types';
import type {
  StorefrontCategory,
  StorefrontCustomer,
  StorefrontOrder,
  StorefrontProduct,
  StorefrontSponsor,
} from './types';

export async function fetchSponsorBySlug(slug: string) {
  const res = await api.get(`/sponsors/${slug}`);
  return res.data as StorefrontSponsor;
}

export async function fetchSponsorProducts(
  slug: string,
  params?: { category?: string; offers?: boolean },
) {
  const res = await api.get(`/sponsors/${slug}/products`, {
    params: {
      category: params?.category,
      offers: params?.offers ? '1' : undefined,
    },
  });
  const data = res.data;
  return (Array.isArray(data) ? data : []) as StorefrontProduct[];
}

export async function fetchSponsorProduct(slug: string, productId: string) {
  const res = await api.get(`/sponsors/${slug}/products/${productId}`);
  return res.data as StorefrontProduct;
}

export async function fetchSponsorCategories(slug: string) {
  const res = await api.get(`/sponsors/${slug}/categories`);
  const data = res.data;
  return (Array.isArray(data) ? data : []) as StorefrontCategory[];
}

export async function quoteShipping(slug: string, body: { postalCode: string; subtotal: number }) {
  const res = await api.post(`/sponsors/${slug}/shipping/quote`, body);
  return res.data as ShippingQuote;
}

export async function checkoutSponsor(slug: string, body: CheckoutPayload) {
  const res = await api.post(`/sponsors/${slug}/checkout`, body);
  return res.data as StorefrontOrder;
}

export async function fetchOrder(slug: string, orderId: string) {
  const res = await api.get(`/sponsors/${slug}/orders/${orderId}`);
  return res.data;
}

export async function registerStorefrontCustomer(
  slug: string,
  body: { email: string; password: string; name: string; phone?: string },
) {
  const res = await api.post(`/sponsors/${slug}/auth/register`, body);
  return res.data as { token: string; customer: StorefrontCustomer };
}

export async function loginStorefrontCustomer(
  slug: string,
  body: { email: string; password: string },
) {
  const res = await api.post(`/sponsors/${slug}/auth/login`, body);
  return res.data as { token: string; customer: StorefrontCustomer };
}

const customerTokenKey = (slug: string) => `sponsor_customer_token_${slug}`;
const customerUserKey = (slug: string) => `sponsor_customer_user_${slug}`;

export function getStorefrontCustomer(slug: string): StorefrontCustomer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(customerUserKey(slug));
    return raw ? (JSON.parse(raw) as StorefrontCustomer) : null;
  } catch {
    return null;
  }
}

export function getStorefrontCustomerToken(slug: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(customerTokenKey(slug));
}

export function setStorefrontCustomer(slug: string, token: string, user: StorefrontCustomer) {
  localStorage.setItem(customerTokenKey(slug), token);
  localStorage.setItem(customerUserKey(slug), JSON.stringify(user));
}

export function clearStorefrontCustomer(slug: string) {
  localStorage.removeItem(customerTokenKey(slug));
  localStorage.removeItem(customerUserKey(slug));
}
