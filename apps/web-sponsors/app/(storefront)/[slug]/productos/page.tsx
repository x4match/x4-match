'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorCategories, fetchSponsorProducts } from '@/lib/storefront-api';
import { formatMoney, productImageUrl } from '@/lib/types';

function ProductsInner() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const categoria = search.get('categoria') || undefined;
  const catsQ = useQuery({
    queryKey: ['store-cats', slug],
    queryFn: () => fetchSponsorCategories(slug),
  });
  const productsQ = useQuery({
    queryKey: ['store-products', slug, categoria],
    queryFn: () => fetchSponsorProducts(slug, { category: categoria }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Productos</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/${slug}/productos`}
          className={`rounded-full border px-3 py-1 text-sm ${!categoria ? 'bg-teal-700 text-white' : ''}`}
        >
          Todos
        </Link>
        {(catsQ.data || []).map((c) => (
          <Link
            key={c.id}
            href={`/${slug}/productos?categoria=${c.slug || c.id}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              categoria === c.slug || categoria === c.id ? 'bg-teal-700 text-white' : ''
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {(productsQ.data || []).map((p: any) => {
          const img = productImageUrl(p) || p.photo_url;
          return (
            <Link key={p.id} href={`/${slug}/productos/${p.id}`} className="rounded-xl border bg-white">
              <div className="aspect-square bg-slate-100">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-3">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 font-bold text-teal-700">{formatMoney(Number(p.price))}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando…</div>}>
      <ProductsInner />
    </Suspense>
  );
}
