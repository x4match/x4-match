'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { fetchSponsorBySlug } from '@/lib/storefront-api';
import { cartCount, getCart } from '@/lib/cart';
import { useEffect, useState } from 'react';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [count, setCount] = useState(0);

  const storeQuery = useQuery({
    queryKey: ['store', slug],
    queryFn: () => fetchSponsorBySlug(slug),
    enabled: !!slug,
  });

  const sponsor = storeQuery.data;
  const color = sponsor?.primary_color || sponsor?.primaryColor || '#03ac0e';

  useEffect(() => {
    if (!sponsor?.id) return;
    const sync = () => setCount(cartCount(getCart(sponsor.id)));
    sync();
    window.addEventListener('sponsor-cart-change', sync);
    return () => window.removeEventListener('sponsor-cart-change', sync);
  }, [sponsor?.id]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sf-sticky-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={`/${slug}`} className="flex min-h-11 items-center gap-2.5 font-extrabold tracking-tight">
            {sponsor?.logo_url || sponsor?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(sponsor.logo_url || sponsor.logoUrl)!}
                alt=""
                className="size-9 rounded-xl object-cover"
              />
            ) : (
              <span
                className="flex size-9 items-center justify-center rounded-xl text-sm font-extrabold text-white"
                style={{ background: color }}
                aria-hidden
              >
                {(sponsor?.name || slug).slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="max-w-[140px] truncate sm:max-w-none">{sponsor?.name || slug}</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium md:flex" aria-label="Tienda">
            <Link href={`/${slug}`} className="text-muted-foreground transition-colors hover:text-foreground">
              Inicio
            </Link>
            <Link
              href={`/${slug}/productos`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Productos
            </Link>
            <Link
              href={`/${slug}/contacto`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Contacto
            </Link>
            <Link
              href={`/${slug}/cuenta/login`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Cuenta
            </Link>
          </nav>
          <Link
            href={`/${slug}/carrito`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: color }}
          >
            <ShoppingCart className="size-4" aria-hidden />
            <span className="hidden sm:inline">Carrito</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{count}</span>
          </Link>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-border bg-card py-10 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">{sponsor?.name}</p>
        <p className="mt-1">Powered by x4 match</p>
      </footer>
    </div>
  );
}
