'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search, ShoppingCart } from 'lucide-react';
import { cartCount, getCart } from '@/lib/cart';
import { sponsorLogoUrl, type StorefrontSponsor } from '@/lib/types';
import { CartSheet } from '@/components/storefront/CartSheet';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ResolvedStoreTheme } from '@/lib/store-theme';

export function StorefrontHeader({
  sponsor,
  theme,
}: {
  sponsor?: StorefrontSponsor | null;
  theme: ResolvedStoreTheme;
}) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [q, setQ] = useState('');
  const logo = sponsor ? sponsorLogoUrl(sponsor) : null;
  const color = theme.primaryColor;
  const name = sponsor?.name || slug;

  useEffect(() => {
    if (!sponsor?.id) return;
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
  }, [sponsor?.id]);

  const links = [
    { href: `/${slug}`, label: 'Inicio' },
    { href: `/${slug}/productos`, label: 'Productos' },
    { href: `/${slug}/contacto`, label: 'Contacto' },
    { href: `/${slug}/cuenta/pedidos`, label: 'Mis pedidos' },
  ];

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-border/80',
          theme.headerStyle === 'blur' && 'bg-card/90 backdrop-blur-md',
          theme.headerStyle === 'solid' && 'bg-card',
          theme.headerStyle === 'transparent' && 'bg-transparent',
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${slug}`} className="flex min-h-11 items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={name}
                className="size-9 object-cover"
                style={{ borderRadius: 'var(--radius)' }}
              />
            ) : (
              <div
                className="flex size-9 items-center justify-center text-sm font-extrabold text-white"
                style={{ background: color, borderRadius: 'var(--radius)' }}
              >
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-extrabold leading-tight tracking-tight">{name}</p>
              <p className="text-xs text-muted-foreground">Tienda oficial</p>
            </div>
          </Link>

          {theme.showSearch ? (
            <form
              className="order-3 flex w-full min-w-0 flex-1 basis-full md:order-none md:basis-auto md:max-w-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const query = q.trim();
                router.push(
                  query
                    ? `/${slug}/productos?q=${encodeURIComponent(query)}`
                    : `/${slug}/productos`,
                );
              }}
            >
              <div className="relative w-full">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar productos…"
                  className="h-10 bg-card pl-9"
                  aria-label="Buscar productos"
                />
              </div>
            </form>
          ) : null}

          <nav className="hidden items-center gap-5 text-sm font-medium lg:flex" aria-label="Tienda">
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
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative inline-flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: color, borderRadius: '9999px' }}
              aria-label={`Abrir carrito, ${count} ítems`}
            >
              <ShoppingCart className="size-4" aria-hidden />
              <span className="hidden sm:inline">Carrito</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{count}</span>
            </button>
          </div>
        </div>
      </header>

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        slug={slug}
        sponsor={sponsor}
        accent={color}
      />
    </>
  );
}
