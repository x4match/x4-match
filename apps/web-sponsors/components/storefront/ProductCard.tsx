'use client';

import Link from 'next/link';
import { formatMoney, productImageUrl, type StorefrontProduct } from '@/lib/types';
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
  const compare = Number(product.compare_at_price || product.compareAtPrice || 0);
  const price = Number(product.price);
  const off = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;

  return (
    <div className={cn(cardStyleClass(cardStyle), 'group')}>
      <Link href={`/${slug}/productos/${product.id}`} className="block">
        <div className="relative aspect-square bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              Sin imagen
            </div>
          )}
          {off > 0 ? <span className="sf-badge-deal">{off}% OFF</span> : null}
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
          {off > 0 ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatMoney(compare, product.currency)}
            </span>
          ) : null}
        </div>
        {quickAdd && sponsorId ? (
          <Button
            type="button"
            size="sm"
            className="min-h-9 w-full font-bold text-white"
            style={accent ? { background: accent } : undefined}
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
            Agregar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
