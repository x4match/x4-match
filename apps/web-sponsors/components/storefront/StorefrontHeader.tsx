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
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href={`/${slug}`} className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={sponsor.name} className="size-9 rounded-lg object-cover" />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {sponsor.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold leading-tight">{sponsor.name}</p>
            <p className="text-xs text-muted-foreground">Tienda oficial</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-4 text-sm md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/cuenta/login`}
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            Cuenta
          </Link>
          <Link
            href={`/${slug}/carrito`}
            className="relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            <ShoppingCart className="size-4" />
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
