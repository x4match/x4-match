'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { checkoutSponsor, fetchSponsorBySlug, quoteShipping } from '@/lib/storefront-api';
import { cartSubtotal, clearCart, getCart } from '@/lib/cart';
import { formatMoney } from '@/lib/types';
import type { CartItem } from '@/lib/types';
import { toast } from 'sonner';

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const [items, setItems] = useState<CartItem[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [coupon, setCoupon] = useState('');
  const [shippingMethodId, setShippingMethodId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MERCADOPAGO' | 'WHATSAPP'>('WHATSAPP');
  const [loading, setLoading] = useState(false);

  const sponsor = storeQ.data;
  const subtotal = cartSubtotal(items);
  const pay = sponsor?.payment_options;

  useEffect(() => {
    if (!sponsor?.id) return;
    setItems(getCart(sponsor.id));
  }, [sponsor?.id]);

  useEffect(() => {
    if (pay?.mpEnabled) setPaymentMethod('MERCADOPAGO');
    else if (pay?.whatsappEnabled) setPaymentMethod('WHATSAPP');
  }, [pay?.mpEnabled, pay?.whatsappEnabled]);

  const quoteQ = useQuery({
    queryKey: ['shipping-quote', slug, postalCode, subtotal],
    queryFn: () => quoteShipping(slug, { postalCode: postalCode || '0000', subtotal }),
    enabled: !!slug && subtotal > 0,
  });

  const shippingCost = useMemo(() => {
    const m = quoteQ.data?.methods?.find((x) => x.id === shippingMethodId);
    return m?.price ?? 0;
  }, [quoteQ.data, shippingMethodId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sponsor?.id || !items.length) return;
    if (!pay?.mpEnabled && !pay?.whatsappEnabled) {
      toast.error('Esta tienda todavía no acepta pagos');
      return;
    }
    setLoading(true);
    try {
      const order = await checkoutSponsor(slug, {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod,
        couponCode: coupon || undefined,
        shippingMethodId: shippingMethodId || undefined,
        shippingPostalCode: postalCode || undefined,
        shippingAddress: address || undefined,
        guestName: name,
        guestEmail: email,
        guestPhone: phone || undefined,
      });
      clearCart(sponsor.id);
      if (order.checkoutUrl) {
        window.location.href = order.checkoutUrl;
        return;
      }
      if (order.whatsappUrl) {
        window.open(order.whatsappUrl, '_blank');
      }
      router.push(`/${slug}/pedido/${order.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return <div className="p-8 text-slate-500">El carrito está vacío.</div>;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <p className="text-sm text-slate-500">Subtotal {formatMoney(subtotal)} + envío {formatMoney(shippingCost)}</p>

      <label className="block text-sm">
        Nombre
        <input className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Email
        <input className="mt-1 w-full rounded border px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Teléfono
        <input className="mt-1 w-full rounded border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="block text-sm">
        Código postal
        <input className="mt-1 w-full rounded border px-3 py-2" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
      </label>
      <label className="block text-sm">
        Dirección
        <input className="mt-1 w-full rounded border px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <label className="block text-sm">
        Cupón
        <input className="mt-1 w-full rounded border px-3 py-2" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
      </label>

      {(quoteQ.data?.methods || []).length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Envío</legend>
          {quoteQ.data!.methods.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="shipping"
                checked={shippingMethodId === m.id}
                onChange={() => setShippingMethodId(m.id)}
              />
              {m.name} — {formatMoney(m.price)}
            </label>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Pago</legend>
        {pay?.mpEnabled ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={paymentMethod === 'MERCADOPAGO'}
              onChange={() => setPaymentMethod('MERCADOPAGO')}
            />
            Mercado Pago
          </label>
        ) : null}
        {pay?.whatsappEnabled ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={paymentMethod === 'WHATSAPP'}
              onChange={() => setPaymentMethod('WHATSAPP')}
            />
            WhatsApp (pago manual)
          </label>
        ) : null}
        {!pay?.mpEnabled && !pay?.whatsappEnabled ? (
          <p className="text-sm text-red-600">La tienda no tiene métodos de pago configurados.</p>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-teal-700 py-3 font-semibold text-white disabled:opacity-60"
      >
        {loading ? 'Procesando…' : 'Confirmar pedido'}
      </button>
    </form>
  );
}
