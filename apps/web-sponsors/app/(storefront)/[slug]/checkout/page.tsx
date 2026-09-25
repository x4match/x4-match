'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { checkoutSponsor, fetchSponsorBySlug, quoteShipping } from '@/lib/storefront-api';
import { cartSubtotal, clearCart, getCart } from '@/lib/cart';
import { formatMoney, type CartItem } from '@/lib/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [error, setError] = useState('');

  const sponsor = storeQ.data;
  const color = sponsor?.primary_color || sponsor?.primaryColor || '#03ac0e';
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
    setError('');
    if (!sponsor?.id || !items.length) return;
    if (!pay?.mpEnabled && !pay?.whatsappEnabled) {
      setError('Esta tienda todavía no acepta pagos');
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
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo crear el pedido';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-muted-foreground">
        El carrito está vacío.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subtotal {formatMoney(subtotal)} + envío {formatMoney(shippingCost)}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">Datos de contacto</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            className="min-h-11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            className="min-h-11"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            className="min-h-11"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">Envío</h2>
        <div className="space-y-2">
          <Label htmlFor="postal">Código postal</Label>
          <Input
            id="postal"
            className="min-h-11"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            className="min-h-11"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon">Cupón</Label>
          <Input
            id="coupon"
            className="min-h-11"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
          />
        </div>
        {(quoteQ.data?.methods || []).length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Método de envío</legend>
            {quoteQ.data!.methods.map((m) => (
              <label
                key={m.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 text-sm"
              >
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
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">Pago</h2>
        {pay?.mpEnabled ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 text-sm">
            <input
              type="radio"
              checked={paymentMethod === 'MERCADOPAGO'}
              onChange={() => setPaymentMethod('MERCADOPAGO')}
            />
            Mercado Pago
          </label>
        ) : null}
        {pay?.whatsappEnabled ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 text-sm">
            <input
              type="radio"
              checked={paymentMethod === 'WHATSAPP'}
              onChange={() => setPaymentMethod('WHATSAPP')}
            />
            WhatsApp (pago manual)
          </label>
        ) : null}
        {!pay?.mpEnabled && !pay?.whatsappEnabled ? (
          <p className="text-sm text-destructive">La tienda no tiene métodos de pago configurados.</p>
        ) : null}
      </section>

      <Button
        type="submit"
        disabled={loading}
        className="min-h-12 w-full rounded-full font-extrabold text-white"
        style={{ background: color }}
      >
        {loading ? 'Procesando…' : 'Confirmar pedido'}
      </Button>
    </form>
  );
}
