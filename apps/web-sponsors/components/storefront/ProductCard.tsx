'use client';

import Link from 'next/link';
import { formatMoney, productImageUrl, type StorefrontProduct } from '@/lib/types';

export function ProductCard({
  slug,
  product,
}: {
  slug: string;
  product: StorefrontProduct;
}) {
  const image = productImageUrl(product);
  const compare = Number(
    (product as StorefrontProduct & { compare_at_price?: number; compareAtPrice?: number })
      .compare_at_price ||
      (product as StorefrontProduct & { compareAtPrice?: number }).compareAtPrice ||
      0,
  );
  const price = Number(product.price);
  const off = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;

  return (
    <Link href={`/${slug}/productos/${product.id}`} className="sf-product-card">
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
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">{product.name}</p>
        <div className="flex items-baseline gap-2">
          <p className="sf-price">{formatMoney(price, product.currency)}</p>
          {off > 0 ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatMoney(compare, product.currency)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
