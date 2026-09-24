import type { CartItem } from './types';

function cartKey(sponsorId: string) {
  return `sponsor_cart_${sponsorId}`;
}

export function getCart(sponsorId: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(cartKey(sponsorId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCart(sponsorId: string, items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(cartKey(sponsorId), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('sponsor-cart-change', { detail: { sponsorId } }));
}

export function clearCart(sponsorId: string) {
  setCart(sponsorId, []);
}

export function addToCart(sponsorId: string, item: Omit<CartItem, 'quantity'> & { quantity?: number }) {
  const items = getCart(sponsorId);
  const qty = item.quantity ?? 1;
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    items.push({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: qty,
      imageUrl: item.imageUrl,
    });
  }
  setCart(sponsorId, items);
  return items;
}

export function updateCartQuantity(sponsorId: string, productId: string, quantity: number) {
  let items = getCart(sponsorId);
  if (quantity <= 0) {
    items = items.filter((i) => i.productId !== productId);
  } else {
    items = items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
  }
  setCart(sponsorId, items);
  return items;
}

export function removeFromCart(sponsorId: string, productId: string) {
  return updateCartQuantity(sponsorId, productId, 0);
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
