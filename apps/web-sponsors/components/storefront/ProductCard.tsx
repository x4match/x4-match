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

  return (
    <Link
      href={`/${slug}/productos/${product.id}`}
      className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="aspect-square bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Sin imagen
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
        <p className="text-base font-bold">{formatMoney(Number(product.price), product.currency)}</p>
      </div>
    </Link>
  );
}
