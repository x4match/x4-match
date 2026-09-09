import { api } from './api';

export type ShopSaleRow = {
  id: string;
  quantity: number;
  subtotal: number | string;
  status: string;
  created_at: string;
  product_name: string;
  user_name: string;
  match_title?: string | null;
  product_id?: string;
  user_id?: string;
  match_id?: string | null;
  unit_price?: number | string;
  photo_url?: string | null;
};

export type ShopProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  stockQuantity?: number | null;
  stock_quantity?: number | null;
  isActive?: boolean;
  active?: boolean;
  photoUrl?: string | null;
  photo_url?: string | null;
  category?: string | null;
  isMatchExtra?: boolean;
  available_as_match_extra?: boolean;
};

export type ShopCoupon = {
  id: string;
  code: string;
  label?: string | null;
  discountPercent?: number | null;
  discount_percent?: number | null;
  discountAmount?: number | null;
  discount_amount?: number | null;
  maxRedemptions?: number | null;
  redeemedCount?: number;
  isActive?: boolean;
  expiresAt?: string | null;
};

export type ShopStats = {
  periodDays: number;
  totalRevenue: number;
  totalSales: number;
  byCategory: Array<{ category: string; revenue: number; salesCount: number }>;
  topProduct?: {
    id: string;
    name: string;
    revenue: number;
    salesCount: number;
  } | null;
  lastSale?: {
    productName: string;
    subtotal: number;
    quantity: number;
    createdAt: string;
  } | null;
  lowStockCount?: number;
  extrasSold?: {
    revenue: number;
    salesCount: number;
  };
};

export const SHOP_CATEGORY_LABELS: Record<string, string> = {
  BALLS: 'Pelotas',
  DRINKS: 'Bebidas',
  FOOD: 'Comida',
  RENTAL: 'Alquiler',
  MERCH: 'Merch',
  OTHER: 'Otros',
};

export const SHOP_CATEGORIES = Object.keys(SHOP_CATEGORY_LABELS);

export function shopStatusLabel(status: string): string {
  if (status === 'CONFIRMED' || status === 'APPROVED') return 'Confirmada';
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'CANCELLED') return 'Cancelada';
  return status;
}

export async function confirmShopPurchase(clubId: string, purchaseId: string) {
  const res = await api.post(`/clubs/${clubId}/shop/purchases/${purchaseId}/confirm`);
  return res.data as { ok: boolean; alreadyConfirmed?: boolean };
}

export async function markDepositPaid(clubId: string, depositId: string) {
  const res = await api.post(`/clubs/${clubId}/deposits/${depositId}/mark-paid`);
  return res.data as { ok: boolean; alreadyPaid?: boolean };
}

export async function listShopSales(clubId: string) {
  const res = await api.get(`/clubs/${clubId}/shop/sales`);
  return res.data as ShopSaleRow[];
}

export async function listShopProductsAdmin(clubId: string) {
  const res = await api.get(`/clubs/${clubId}/shop/products/manage`);
  return res.data as ShopProduct[];
}

export type PosDaySale = {
  id: string;
  sale_group_id?: string | null;
  quantity: number;
  unit_price?: number | string;
  subtotal: number | string;
  status: string;
  payment_method?: string | null;
  note?: string | null;
  created_at: string;
  product_name: string;
  user_name: string;
  sold_by_name?: string | null;
};

export type PosDaySales = {
  date: string;
  total: number;
  byMethod: Record<string, number>;
  sales: PosDaySale[];
};

export async function createPosSale(
  clubId: string,
  payload: {
    items: Array<{ productId: string; quantity: number }>;
    paymentMethod: 'CASH' | 'MP' | 'MANUAL' | 'OTHER';
    customerUserId?: string;
    note?: string;
  },
) {
  const res = await api.post(`/clubs/${clubId}/shop/pos/sale`, payload);
  return res.data as {
    saleGroupId: string;
    paymentMethod: string;
    total: number;
    items: Array<{ id: string; product_name: string; quantity: number; subtotal: number }>;
  };
}

export async function listPosDaySales(clubId: string, date?: string) {
  const res = await api.get(`/clubs/${clubId}/shop/pos/day`, {
    params: date ? { date } : undefined,
  });
  return res.data as PosDaySales;
}

export async function uploadShopProductPhoto(
  clubId: string,
  productId: string,
  file: File,
) {
  const form = new FormData();
  form.append('photo', file);
  const res = await api.post(`/clubs/${clubId}/shop/products/${productId}/photo`, form);
  return (res.data.photo_url || res.data.photoUrl) as string;
}
