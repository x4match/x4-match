'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorBySlug } from '@/lib/storefront-api';
import { cartSubtotal, getCart, removeFromCart, updateCartQuantity } from '@/lib/cart';
import { formatMoney } from '@/lib/types';
import type { CartItem } from '@/lib/types';

export default function CartPage() {
  const { slug } = useParams<{ slug: string }>();
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!storeQ.data?.id) return;
    const sync = () => setItems(getCart(storeQ.data!.id));
    sync();
    window.addEventListener('sponsor-cart-change', sync);
    return () => window.removeEventListener('sponsor-cart-change', sync);
  }, [storeQ.data?.id]);

  const sponsorId = storeQ.data?.id;
  const subtotal = cartSubtotal(items);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Carrito</h1>
      {!items.length ? (
        <p className="mt-4 text-slate-500">
          Tu carrito está vacío. <Link href={`/${slug}/productos`}>Ver productos</Link>
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.productId} className="flex items-center gap-4 rounded-xl border bg-white p-4">
              <div className="flex-1">
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-teal-700">{formatMoney(item.price)}</p>
              </div>
              <input
                type="number"
                min={1}
                className="w-16 rounded border px-2 py-1"
                value={item.quantity}
                onChange={(e) =>
                  sponsorId && updateCartQuantity(sponsorId, item.productId, Number(e.target.value))
                }
              />
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => sponsorId && removeFromCart(sponsorId, item.productId)}
              >
                Quitar
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-lg font-bold">Subtotal: {formatMoney(subtotal)}</p>
            <Link
              href={`/${slug}/checkout`}
              className="rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white"
            >
              Ir al checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
