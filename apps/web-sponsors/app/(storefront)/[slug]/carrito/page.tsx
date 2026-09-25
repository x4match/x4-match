'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorBySlug } from '@/lib/storefront-api';
import { cartSubtotal, getCart, removeFromCart, updateCartQuantity } from '@/lib/cart';
import { formatMoney, type CartItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CartPage() {
  const { slug } = useParams<{ slug: string }>();
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const [items, setItems] = useState<CartItem[]>([]);
  const color = storeQ.data?.primary_color || storeQ.data?.primaryColor || '#03ac0e';

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
      <h1 className="text-3xl font-extrabold tracking-tight">Carrito</h1>
      {!items.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <p className="text-muted-foreground">Tu carrito está vacío.</p>
          <Button asChild className="mt-4 min-h-11 font-bold text-white" style={{ background: color }}>
            <Link href={`/${slug}/productos`}>Ver productos</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <div className="size-16 overflow-hidden rounded-xl bg-muted">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.name}</p>
                <p className="sf-price text-sm" style={{ color }}>
                  {formatMoney(item.price)}
                </p>
              </div>
              <Input
                type="number"
                min={1}
                className="h-10 w-20"
                value={item.quantity}
                onChange={(e) =>
                  sponsorId && updateCartQuantity(sponsorId, item.productId, Number(e.target.value))
                }
                aria-label={`Cantidad de ${item.name}`}
              />
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => sponsorId && removeFromCart(sponsorId, item.productId)}
              >
                Quitar
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-lg font-extrabold">Subtotal: {formatMoney(subtotal)}</p>
            <Button asChild className="min-h-11 rounded-full px-6 font-bold text-white" style={{ background: color }}>
              <Link href={`/${slug}/checkout`}>Ir al checkout</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
