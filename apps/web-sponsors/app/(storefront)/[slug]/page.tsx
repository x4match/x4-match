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
  const color = sponsor?.primary_color || '#03ac0e';

  return (
    <div>
      <section
        className="relative overflow-hidden px-4 py-16 text-white md:py-20"
        style={{
          background: sponsor?.banner_url
            ? `linear-gradient(rgba(0,0,0,.42), rgba(0,0,0,.55)), url(${sponsor.banner_url}) center/cover`
            : `linear-gradient(135deg, ${color} 0%, #0b1220 100%)`,
        }}
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">Tienda oficial</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">
            {sponsor?.name || 'Tienda'}
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/90 md:text-lg">
            {sponsor?.tagline || sponsor?.home_intro || sponsor?.description || 'Productos oficiales'}
          </p>
          <Link
            href={`/${slug}/productos`}
            className="mt-8 inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-extrabold text-slate-900 transition-transform duration-150 hover:scale-[1.02]"
          >
            Ver productos
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Categorías</h2>
            <p className="mt-1 text-sm text-muted-foreground">Explorá por tipo de producto</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-4">
          {(catsQ.data || []).map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/productos?categoria=${c.slug || c.id}`}
              className="sf-category-chip"
            >
              <span
                className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: color }}
                aria-hidden
              >
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              {c.name}
            </Link>
          ))}
          {!catsQ.data?.length ? (
            <p className="col-span-full text-sm text-muted-foreground">Pronto vas a ver categorías acá.</p>
          ) : null}
        </div>
      </section>

      {(offersQ.data || []).length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <h2 className="text-xl font-extrabold tracking-tight">Ofertas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Descuentos activos ahora</p>
          <ProductGrid slug={slug} products={offersQ.data!} color={color} />
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-6 pb-16">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Productos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Lo más reciente de la tienda</p>
          </div>
          <Link
            href={`/${slug}/productos`}
            className="text-sm font-bold text-commerce transition-opacity hover:opacity-80"
          >
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
  products: Array<Record<string, unknown>>;
  color: string;
}) {
  return (
    <div className="mt-5 grid gap-4 grid-cols-2 md:grid-cols-4">
      {products.map((p) => {
        const compare = Number(p.compare_at_price || p.compareAtPrice || 0);
        const price = Number(p.price);
        const off = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
        const img = productImageUrl(p as never) || (p.photo_url as string | undefined);
        return (
          <Link key={String(p.id)} href={`/${slug}/productos/${p.id}`} className="sf-product-card">
            <div className="relative aspect-square bg-muted">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt=""
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
              <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">{String(p.name)}</p>
              <div className="flex items-baseline gap-2">
                <span className="sf-price" style={{ color }}>
                  {formatMoney(price)}
                </span>
                {off > 0 ? (
                  <span className="text-xs text-muted-foreground line-through">{formatMoney(compare)}</span>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
