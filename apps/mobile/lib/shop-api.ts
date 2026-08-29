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
};

export async function confirmShopPurchase(clubId: string, purchaseId: string) {
  const res = await api.post(`/clubs/${clubId}/shop/purchases/${purchaseId}/confirm`);
  return res.data as { ok: boolean; alreadyConfirmed?: boolean; purchase?: unknown };
}

export async function markDepositPaid(clubId: string, depositId: string) {
  const res = await api.post(`/clubs/${clubId}/deposits/${depositId}/mark-paid`);
  return res.data as { ok: boolean; alreadyPaid?: boolean; deposit?: unknown };
}

export async function listShopSales(clubId: string) {
  const res = await api.get(`/clubs/${clubId}/shop/sales`);
  return res.data as ShopSaleRow[];
}
