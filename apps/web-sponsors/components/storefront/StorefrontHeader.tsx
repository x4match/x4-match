'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { cartCount, getCart } from '@/lib/cart';
import { sponsorLogoUrl, type StorefrontSponsor } from '@/lib/types';

export function StorefrontHeader({ sponsor }: { sponsor: StorefrontSponsor }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [count, setCount] = useState(0);
  const logo = sponsorLogoUrl(sponsor);

  useEffect(() => {
    const sync = () => setCount(cartCount(getCart(sponsor.id)));
    sync();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ sponsorId: string }>).detail;
      if (!detail || detail.sponsorId === sponsor.id) sync();
    };
    window.addEventListener('sponsor-cart-change', onChange);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sponsor-cart-change', onChange);
      window.removeEventListener('storage', sync);
    };
  }, [sponsor.id]);

  const links = [
    { href: `/${slug}`, label: 'Inicio' },
    { href: `/${slug}/productos`, label: 'Productos' },
    { href: `/${slug}/contacto`, label: 'Contacto' },
    { href: `/${slug}/cuenta/pedidos`, label: 'Mis pedidos' },
  ];

  return (
    <header className="sf-sticky-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={`/${slug}`} className="flex min-h-11 items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={sponsor.name} className="size-9 rounded-xl object-cover" />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
              {sponsor.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-extrabold leading-tight tracking-tight">{sponsor.name}</p>
            <p className="text-xs text-muted-foreground">Tienda oficial</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium md:flex" aria-label="Tienda">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/cuenta/login`}
            className="hidden min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Cuenta
          </Link>
          <Link
            href={`/${slug}/carrito`}
            className="relative inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold transition-colors hover:border-primary/40"
          >
            <ShoppingCart className="size-4" aria-hidden />
            Carrito
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
