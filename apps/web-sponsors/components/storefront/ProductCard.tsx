'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { formatMoney, productFlags, productImageUrl, type StorefrontProduct } from '@/lib/types';
import { addToCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cardStyleClass, type ResolvedStoreTheme } from '@/lib/store-theme';
import { cn } from '@/lib/utils';

export function ProductCard({
  slug,
  product,
  sponsorId,
  accent,
  quickAdd,
  cardStyle = 'soft',
}: {
  slug: string;
  product: StorefrontProduct;
  sponsorId?: string;
  accent?: string;
  quickAdd?: boolean;
  cardStyle?: ResolvedStoreTheme['cardStyle'];
}) {
  const image = productImageUrl(product);
  const price = Number(product.price);
  const flags = productFlags(product);

  return (
    <div
      className={cn(
        cardStyleClass(cardStyle),
        'group',
        flags.featured && 'sf-card-featured',
      )}
      style={flags.featured && accent ? { ['--sf-featured' as string]: accent } : undefined}
    >
      <Link href={`/${slug}/productos/${product.id}`} className="block">
        <div className="sf-product-media relative overflow-hidden bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              className={cn(
                'size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]',
                flags.soldOut && 'opacity-60 grayscale',
              )}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              Sin imagen
            </div>
          )}

          <div className="sf-badges">
            {flags.featured ? (
              <span
                className="sf-badge sf-badge-featured"
                style={accent ? { background: accent } : undefined}
              >
                <Star className="size-3 fill-current" aria-hidden />
                Destacado
              </span>
            ) : null}
            {flags.discountPercent > 0 ? (
              <span className="sf-badge sf-badge-deal">-{flags.discountPercent}%</span>
            ) : null}
            {flags.isNew ? <span className="sf-badge sf-badge-new">Nuevo</span> : null}
          </div>

          {flags.soldOut ? (
            <span className="sf-badge sf-badge-soldout">Sin stock</span>
          ) : flags.lowStockLeft != null ? (
            <span className="sf-badge sf-badge-lowstock">
              {flags.lowStockLeft === 1 ? '¡Última unidad!' : `¡Quedan ${flags.lowStockLeft}!`}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="space-y-2 p-3">
        <Link href={`/${slug}/productos/${product.id}`}>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">
            {product.name}
          </p>
        </Link>
        <div className="flex items-baseline gap-2">
          <p className="sf-price" style={accent ? { color: accent } : undefined}>
            {formatMoney(price, product.currency)}
          </p>
          {flags.compareAtPrice ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatMoney(flags.compareAtPrice, product.currency)}
            </span>
          ) : null}
        </div>
        {quickAdd && sponsorId ? (
          <Button
            type="button"
            size="sm"
            className="sf-button min-h-9 w-full font-bold text-white"
            style={accent && !flags.soldOut ? { background: accent } : undefined}
            disabled={flags.soldOut}
            onClick={() => {
              addToCart(sponsorId, {
                productId: product.id,
                name: product.name,
                price,
                imageUrl: image || undefined,
                quantity: 1,
              });
              toast.success('Agregado al carrito');
            }}
          >
            {flags.soldOut ? 'Sin stock' : 'Agregar'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
