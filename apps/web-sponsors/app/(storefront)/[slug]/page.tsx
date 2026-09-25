'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  fetchSponsorBySlug,
  fetchSponsorCategories,
  fetchSponsorProducts,
} from '@/lib/storefront-api';
import { ProductCard } from '@/components/storefront/ProductCard';
import { useResolvedTheme } from '@/components/storefront/StoreThemeScope';
import { productGridClass } from '@/lib/store-theme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    enabled: true,
  });

  const sponsor = storeQ.data;
  const theme = useResolvedTheme(sponsor);
  const color = theme.primaryColor;
  const headline = theme.heroHeadline || sponsor?.name || 'Tienda';
  const support =
    sponsor?.tagline || sponsor?.home_intro || sponsor?.description || 'Productos oficiales';

  return (
    <div>
      <section
        className={cn(
          'relative overflow-hidden px-4 text-white',
          theme.heroStyle === 'minimal' && 'py-12 md:py-14',
          theme.heroStyle === 'banner-only' && 'py-10 md:py-12',
          (theme.heroStyle === 'full-bleed' || theme.heroStyle === 'split') && 'py-16 md:py-20',
          theme.heroStyle === 'split' && 'md:grid md:grid-cols-2 md:items-center md:gap-8',
        )}
        style={{
          background: sponsor?.banner_url
            ? `linear-gradient(rgba(0,0,0,${theme.heroOverlay}), rgba(0,0,0,${theme.heroOverlay})), url(${sponsor.banner_url}) center/cover`
            : `linear-gradient(135deg, ${color} 0%, ${theme.colorMode === 'dark' ? '#000' : '#0b1220'} 100%)`,
        }}
      >
        <div className="mx-auto max-w-6xl md:col-span-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">Tienda oficial</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">
            {headline}
          </h1>
          {theme.showTagline ? (
            <p className="mt-3 max-w-xl text-base text-white/90 md:text-lg">{support}</p>
          ) : null}
          <Button
            asChild
            className="mt-8 min-h-11 rounded-full bg-white px-6 font-extrabold text-slate-900 hover:bg-white/90"
          >
            <Link href={`/${slug}/productos`}>{theme.ctaLabel}</Link>
          </Button>
        </div>
        {theme.heroStyle === 'split' ? (
          <div className="mx-auto mt-8 hidden max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm md:mt-0 md:block">
            <p className="text-sm font-semibold text-white/90">
              {sponsor?.home_intro || 'Encontrá productos oficiales y ofertas.'}
            </p>
          </div>
        ) : null}
      </section>

      {theme.showCategories ? (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold tracking-tight">Categorías</h2>
            <p className="mt-1 text-sm text-muted-foreground">Explorá por tipo de producto</p>
          </div>
          <div className="sf-category-rail">
            {(catsQ.data || []).map((c) => (
              <Link
                key={c.id}
                href={`/${slug}/productos?categoria=${c.slug || c.id}`}
                className="sf-category-chip min-w-[120px]"
                style={{ borderRadius: 'var(--radius)' }}
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
              <p className="text-sm text-muted-foreground">Pronto vas a ver categorías acá.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {theme.showOffers && (offersQ.data || []).length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <h2 className="text-xl font-extrabold tracking-tight">Ofertas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Descuentos activos ahora</p>
          <div className={cn('mt-5', productGridClass(theme.productGridCols))}>
            {offersQ.data!.map((p) => (
              <ProductCard
                key={p.id}
                slug={slug}
                product={p}
                accent={color}
                cardStyle={theme.cardStyle}
              />
            ))}
          </div>
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
            className="text-sm font-bold transition-opacity hover:opacity-80"
            style={{ color }}
          >
            Ver todos
          </Link>
        </div>
        <div className={cn('mt-5', productGridClass(theme.productGridCols))}>
          {(productsQ.data || []).slice(0, theme.productGridCols * 2).map((p) => (
            <ProductCard
              key={p.id}
              slug={slug}
              product={p}
              accent={color}
              cardStyle={theme.cardStyle}
            />
          ))}
        </div>
        {!productsQ.data?.length && !productsQ.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Todavía no hay productos publicados.</p>
        ) : null}
      </section>
    </div>
  );
}
