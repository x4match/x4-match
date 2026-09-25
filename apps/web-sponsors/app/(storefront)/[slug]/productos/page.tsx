'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  fetchSponsorBySlug,
  fetchSponsorCategories,
  fetchSponsorProducts,
} from '@/lib/storefront-api';
import { ProductCard } from '@/components/storefront/ProductCard';
import { useResolvedTheme } from '@/components/storefront/StoreThemeScope';
import { productGridClass } from '@/lib/store-theme';
import { cn } from '@/lib/utils';

function ProductsInner() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const categoria = search.get('categoria') || undefined;
  const q = search.get('q') || undefined;
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const catsQ = useQuery({
    queryKey: ['store-cats', slug],
    queryFn: () => fetchSponsorCategories(slug),
  });
  const productsQ = useQuery({
    queryKey: ['store-products', slug, categoria],
    queryFn: () => fetchSponsorProducts(slug, { category: categoria }),
  });

  const theme = useResolvedTheme(storeQ.data);
  const color = theme.primaryColor;
  const products = (productsQ.data || []).filter((p) => {
    if (!q) return true;
    return p.name.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Productos</h1>
      {q ? (
        <p className="mt-1 text-sm text-muted-foreground">Resultados para “{q}”</p>
      ) : null}
      {theme.showCategories ? (
        <div className="sf-category-rail mt-4">
          <Link
            href={`/${slug}/productos`}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              !categoria ? 'border-transparent text-white' : 'border-border bg-card',
            )}
            style={!categoria ? { background: color } : undefined}
          >
            Todos
          </Link>
          {(catsQ.data || []).map((c) => {
            const active = categoria === c.slug || categoria === c.id;
            return (
              <Link
                key={c.id}
                href={`/${slug}/productos?categoria=${c.slug || c.id}`}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  active ? 'border-transparent text-white' : 'border-border bg-card',
                )}
                style={active ? { background: color } : undefined}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      ) : null}
      <div className={cn('mt-6', productGridClass(theme.productGridCols))}>
        {products.map((p) => (
          <ProductCard
            key={p.id}
            slug={slug}
            product={p}
            sponsorId={storeQ.data?.id}
            accent={color}
            cardStyle={theme.cardStyle}
            quickAdd
          />
        ))}
      </div>
      {!productsQ.isLoading && !products.length ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No hay productos para mostrar.
        </p>
      ) : null}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Cargando…</div>}>
      <ProductsInner />
    </Suspense>
  );
}
