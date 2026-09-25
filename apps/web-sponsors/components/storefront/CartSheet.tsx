'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  cartSubtotal,
  getCart,
  removeFromCart,
  updateCartQuantity,
} from '@/lib/cart';
import { formatMoney, type CartItem, type StorefrontSponsor } from '@/lib/types';

export function CartSheet({
  open,
  onOpenChange,
  slug,
  sponsor,
  accent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  sponsor: StorefrontSponsor | null | undefined;
  accent: string;
}) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!sponsor?.id) return;
    const sync = () => setItems(getCart(sponsor.id));
    sync();
    window.addEventListener('sponsor-cart-change', sync);
    return () => window.removeEventListener('sponsor-cart-change', sync);
  }, [sponsor?.id]);

  const subtotal = cartSubtotal(items);
  const sponsorId = sponsor?.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Carrito</SheetTitle>
          <SheetDescription>
            {items.length ? `${items.length} producto(s)` : 'Tu carrito está vacío'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-1 py-4">
          {!items.length ? (
            <p className="text-sm text-muted-foreground">
              Agregá productos desde el catálogo.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.productId}
                className="flex gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold">{item.name}</p>
                  <p className="sf-price mt-1 text-sm">{formatMoney(item.price)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Menos"
                      onClick={() =>
                        sponsorId &&
                        updateCartQuantity(sponsorId, item.productId, item.quantity - 1)
                      }
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Más"
                      onClick={() =>
                        sponsorId &&
                        updateCartQuantity(sponsorId, item.productId, item.quantity + 1)
                      }
                    >
                      <Plus className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto text-destructive"
                      aria-label="Quitar"
                      onClick={() => sponsorId && removeFromCart(sponsorId, item.productId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <SheetFooter className="border-t border-border pt-4">
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-lg font-extrabold">{formatMoney(subtotal)}</span>
            </div>
            <Button
              asChild
              className="min-h-11 w-full font-bold text-white"
              style={{ background: accent }}
              disabled={!items.length}
            >
              <Link href={`/${slug}/checkout`} onClick={() => onOpenChange(false)}>
                Ir al checkout
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href={`/${slug}/carrito`} onClick={() => onOpenChange(false)}>
                Ver carrito completo
              </Link>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
