'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
  const color = sponsor?.primary_color || sponsor?.primaryColor || '#0f766e';

  useEffect(() => {
    if (!sponsor?.id) return;
    const sync = () => setCount(cartCount(getCart(sponsor.id)));
    sync();
    window.addEventListener('sponsor-cart-change', sync);
    return () => window.removeEventListener('sponsor-cart-change', sync);
  }, [sponsor?.id]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={`/${slug}`} className="flex items-center gap-2 font-bold" style={{ color }}>
            {sponsor?.logo_url || sponsor?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(sponsor.logo_url || sponsor.logoUrl)!}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : null}
            {sponsor?.name || slug}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={`/${slug}`}>Inicio</Link>
            <Link href={`/${slug}/productos`}>Productos</Link>
            <Link href={`/${slug}/contacto`}>Contacto</Link>
            <Link href={`/${slug}/cuenta/login`}>Cuenta</Link>
            <Link
              href={`/${slug}/carrito`}
              className="rounded-full px-3 py-1 font-semibold text-white"
              style={{ background: color }}
            >
              Carrito ({count})
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-12 border-t bg-white py-8 text-center text-sm text-slate-500">
        {sponsor?.name} · Powered by x4 match
      </footer>
    </div>
  );
}
