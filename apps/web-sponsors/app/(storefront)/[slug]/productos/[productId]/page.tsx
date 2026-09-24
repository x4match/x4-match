'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorBySlug, fetchSponsorProduct } from '@/lib/storefront-api';
import { addToCart } from '@/lib/cart';
import { formatMoney, productImageUrl } from '@/lib/types';
import { toast } from 'sonner';

export default function ProductDetailPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const router = useRouter();
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const productQ = useQuery({
    queryKey: ['store-product', slug, productId],
    queryFn: () => fetchSponsorProduct(slug, productId),
  });

  const p: any = productQ.data;
  const sponsor = storeQ.data;
  if (productQ.isLoading) return <div className="p-8">Cargando…</div>;
  if (!p) return <div className="p-8">Producto no encontrado</div>;

  const img = productImageUrl(p) || p.photo_url;
  const compare = Number(p.compare_at_price || 0);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div>
        <h1 className="text-3xl font-bold">{p.name}</h1>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-bold text-teal-700">{formatMoney(Number(p.price))}</span>
          {compare > Number(p.price) ? (
            <span className="text-slate-400 line-through">{formatMoney(compare)}</span>
          ) : null}
        </div>
        {p.description ? <p className="mt-4 text-slate-600 whitespace-pre-wrap">{p.description}</p> : null}
        <button
          type="button"
          className="mt-6 rounded-full bg-teal-700 px-6 py-3 font-semibold text-white"
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
            router.push(`/${slug}/carrito`);
          }}
        >
          Agregar al carrito
        </button>
        {sponsor?.contact_whatsapp || (sponsor as any)?.contact_whatsapp ? (
          <a
            className="mt-3 block text-sm text-teal-700 underline"
            href={`https://wa.me/${String((sponsor as any).contact_whatsapp || '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            Consultar por WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
