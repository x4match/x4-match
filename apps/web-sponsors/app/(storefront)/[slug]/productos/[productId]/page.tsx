'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorBySlug, fetchSponsorProduct } from '@/lib/storefront-api';
import { addToCart } from '@/lib/cart';
import { formatMoney, productImageUrl } from '@/lib/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function ProductDetailPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const productQ = useQuery({
    queryKey: ['store-product', slug, productId],
    queryFn: () => fetchSponsorProduct(slug, productId),
  });

  const p = productQ.data as
    | (Record<string, unknown> & {
        id: string;
        name: string;
        price: number;
        description?: string;
        compare_at_price?: number;
        photo_url?: string;
      })
    | undefined;
  const sponsor = storeQ.data;
  const color = sponsor?.primary_color || sponsor?.primaryColor || '#03ac0e';

  if (productQ.isLoading) {
    return <div className="p-8 text-muted-foreground">Cargando…</div>;
  }
  if (!p) {
    return <div className="p-8">Producto no encontrado</div>;
  }

  const img = productImageUrl(p as never) || p.photo_url;
  const compare = Number(p.compare_at_price || 0);
  const wa = sponsor?.contact_whatsapp || (sponsor as { contact_whatsapp?: string } | undefined)?.contact_whatsapp;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 pb-28 md:grid-cols-2 md:pb-8">
      <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={p.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">Sin imagen</div>
        )}
      </div>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{p.name}</h1>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="sf-price text-2xl" style={{ color }}>
            {formatMoney(Number(p.price))}
          </span>
          {compare > Number(p.price) ? (
            <span className="text-muted-foreground line-through">{formatMoney(compare)}</span>
          ) : null}
        </div>
        {p.description ? (
          <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{p.description}</p>
        ) : null}
        <Button
          type="button"
          className="mt-6 hidden min-h-12 w-full rounded-full font-extrabold text-white md:inline-flex md:w-auto md:px-8"
          style={{ background: color }}
          onClick={() => {
            if (!sponsor?.id) return;
            addToCart(sponsor.id, {
              productId: p.id,
              name: p.name,
              price: Number(p.price),
              imageUrl: img,
              quantity: 1,
            });
            toast.success('Agregado al carrito');
            window.dispatchEvent(new Event('sponsor-cart-change'));
          }}
        >
          Agregar al carrito
        </Button>
        {wa ? (
          <a
            className="mt-3 hidden text-sm font-semibold underline md:block"
            style={{ color }}
            href={`https://wa.me/${String(wa).replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            Consultar por WhatsApp
          </a>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name}</p>
            <p className="sf-price text-sm" style={{ color }}>
              {formatMoney(Number(p.price))}
            </p>
          </div>
          <Button
            type="button"
            className="min-h-11 shrink-0 rounded-full px-5 font-extrabold text-white"
            style={{ background: color }}
            onClick={() => {
              if (!sponsor?.id) return;
              addToCart(sponsor.id, {
                productId: p.id,
                name: p.name,
                price: Number(p.price),
                imageUrl: img,
                quantity: 1,
              });
              toast.success('Agregado al carrito');
            }}
          >
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}
