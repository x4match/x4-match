'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorBySlug, fetchSponsorCategories, fetchSponsorProducts } from '@/lib/storefront-api';
import { formatMoney, productImageUrl } from '@/lib/types';

export default function StoreHomePage() {
  const { slug } = useParams<{ slug: string }>();
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const catsQ = useQuery({
    queryKey: ['store-cats', slug],
    queryFn: () => fetchSponsorCategories(slug),
  });
  const productsQ = useQuery({
    queryKey: ['store-products', slug],
    queryFn: () => fetchSponsorProducts(slug),
  });
  const offersQ = useQuery({
    queryKey: ['store-offers', slug],
    queryFn: () => fetchSponsorProducts(slug, { offers: true }),
  });

  const sponsor = storeQ.data;
  const color = sponsor?.primary_color || '#0f766e';

  return (
    <div>
      <section
        className="relative overflow-hidden px-4 py-16 text-white"
        style={{
          background: sponsor?.banner_url
            ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55)), url(${sponsor.banner_url}) center/cover`
            : color,
        }}
      >
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-bold">{sponsor?.name || 'Tienda'}</h1>
          <p className="mt-2 max-w-xl text-white/90">
            {sponsor?.tagline || sponsor?.home_intro || sponsor?.description || 'Productos oficiales'}
          </p>
          <Link
            href={`/${slug}/productos`}
            className="mt-6 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
          >
            Ver productos
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-bold">Categorías</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {(catsQ.data || []).map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/productos?categoria=${c.slug || c.id}`}
              className="rounded-xl border bg-white p-4 font-semibold hover:border-teal-600"
            >
              {c.name}
            </Link>
          ))}
          {!catsQ.data?.length ? (
            <p className="text-sm text-slate-500">Pronto vas a ver categorías acá.</p>
          ) : null}
        </div>
      </section>

      {(offersQ.data || []).length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <h2 className="text-xl font-bold">Ofertas</h2>
          <ProductGrid slug={slug} products={offersQ.data!} color={color} />
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-6 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Productos</h2>
          <Link href={`/${slug}/productos`} className="text-sm font-semibold text-teal-700">
            Ver todos
          </Link>
        </div>
        <ProductGrid slug={slug} products={(productsQ.data || []).slice(0, 8)} color={color} />
      </section>
    </div>
  );
}

function ProductGrid({
  slug,
  products,
  color,
}: {
  slug: string;
  products: any[];
  color: string;
}) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      {products.map((p) => {
        const compare = Number(p.compare_at_price || p.compareAtPrice || 0);
        const price = Number(p.price);
        const off = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
        const img = productImageUrl(p) || p.photo_url;
        return (
          <Link
            key={p.id}
            href={`/${slug}/productos/${p.id}`}
            className="overflow-hidden rounded-xl border bg-white"
          >
            <div className="relative aspect-square bg-slate-100">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-full w-full object-cover" />
              ) : null}
              {off > 0 ? (
                <span
                  className="absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-bold text-white"
                  style={{ background: color }}
                >
                  {off}% OFF
                </span>
              ) : null}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-semibold">{p.name}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-bold" style={{ color }}>
                  {formatMoney(price)}
                </span>
                {off > 0 ? (
                  <span className="text-xs text-slate-400 line-through">{formatMoney(compare)}</span>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
