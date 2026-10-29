'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchOrder,
  getRememberedOrderEmail,
  openOrderClaim,
  postBuyerOrderAction,
  rememberOrderEmail,
  reviewOrder,
  withdrawOrderClaim,
  type BuyerOrderAction,
} from '@/lib/storefront-api';
import {
  CLAIM_STATUS_LABELS,
  formatMoney,
  type OrderProtection,
  type ShopClaimReason,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de pago',
  AWAITING_MANUAL_PAYMENT: 'Esperando pago manual',
  PAID: 'Pagado, en preparación',
  FULFILLED: 'Enviado / entregado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reintegrado',
};

const CLAIM_REASONS: Array<{ value: ShopClaimReason; label: string }> = [
  { value: 'NOT_RECEIVED', label: 'No recibí el pedido' },
  { value: 'PAYMENT_NOT_ACKNOWLEDGED', label: 'Pagué y la tienda no lo confirma' },
  { value: 'NOT_AS_DESCRIBED', label: 'El producto no es lo que compré' },
  { value: 'NO_RESPONSE', label: 'La tienda no responde' },
  { value: 'SUSPECTED_SCAM', label: 'Creo que es una estafa' },
  { value: 'OTHER', label: 'Otro problema' },
];

function formatDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function errorMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  return Array.isArray(message) ? message[0] : message || fallback;
}

export default function OrderPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const queryClient = useQueryClient();
  const orderQ = useQuery({
    queryKey: ['order', slug, orderId],
    queryFn: () => fetchOrder(slug, orderId),
  });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimReason, setClaimReason] = useState<ShopClaimReason>('NOT_RECEIVED');
  const [claimText, setClaimText] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    setEmail(getRememberedOrderEmail(orderId));
  }, [orderId]);

  const order: any = orderQ.data;
  const protection: OrderProtection | null = order?.protection ?? null;

  if (orderQ.isLoading) return <div className="p-8">Cargando…</div>;
  if (!order) return <div className="p-8">Pedido no encontrado</div>;

  async function run(action: () => Promise<OrderProtection>, success: string) {
    if (!email.trim()) {
      toast.error('Ingresá el email que usaste en la compra');
      return false;
    }
    setBusy(true);
    try {
      await action();
      rememberOrderEmail(orderId, email);
      await queryClient.invalidateQueries({ queryKey: ['order', slug, orderId] });
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo completar la acción'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const simpleAction = (action: BuyerOrderAction, success: string) =>
    run(() => postBuyerOrderAction(slug, orderId, action, email), success);

  async function onClaim(e: FormEvent) {
    e.preventDefault();
    const ok = await run(
      () => openOrderClaim(slug, orderId, { email, reason: claimReason, description: claimText }),
      'Reclamo enviado. Le avisamos a la tienda.',
    );
    if (ok) {
      setClaimOpen(false);
      setClaimText('');
    }
  }

  async function onReview(e: FormEvent) {
    e.preventDefault();
    await run(
      () => reviewOrder(slug, orderId, { email, rating, comment: comment || undefined }),
      '¡Gracias por tu calificación!',
    );
  }

  const openClaim = protection?.claims.find((c) =>
    ['OPEN', 'PARTNER_RESPONDED'].includes(c.status),
  );
  const hasActions =
    protection &&
    (protection.can_report_payment ||
      protection.can_confirm_received ||
      protection.can_open_claim ||
      protection.can_review ||
      openClaim);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Pedido #{String(order.id).slice(0, 8).toUpperCase()}</h1>
        <p className="mt-2 text-slate-600">
          Estado: <strong>{STATUS_LABELS[order.status] ?? order.status}</strong>
        </p>
        <p className="mt-1 text-lg font-bold text-teal-700">{formatMoney(Number(order.total))}</p>
        <p className="mt-2 text-xs text-slate-500">
          Guardá este link: es el comprobante de tu compra y desde acá podés reclamar.
        </p>
      </div>

      {order.status === 'AWAITING_MANUAL_PAYMENT' ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {protection?.buyer_reported_paid_at
            ? `Avisaste que pagaste el ${formatDate(protection.buyer_reported_paid_at)}. Si la tienda no lo confirma en 48 h se abre un reclamo automático.`
            : 'Coordiná el pago por WhatsApp. Cuando transfieras, tocá "Ya pagué" abajo para que corra el plazo de protección.'}
        </div>
      ) : null}

      {protection?.delivery_deadline_at && !protection.received_at ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          La tienda tiene hasta el <strong>{formatDate(protection.delivery_deadline_at)}</strong>{' '}
          para enviarte el pedido. Si no llega, se abre un reclamo automático.
        </p>
      ) : null}

      {protection?.tracking_note ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          Envío: <strong>{protection.tracking_note}</strong>
        </p>
      ) : null}

      <ul className="space-y-2">
        {(order.items || []).map((item: any) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.product_name} x{item.quantity}
            </span>
            <span>{formatMoney(Number(item.subtotal))}</span>
          </li>
        ))}
      </ul>

      {protection?.claims.length ? (
        <section className="space-y-3">
          <h2 className="text-base font-bold">Reclamos</h2>
          {protection.claims.map((claim) => (
            <div key={claim.id} className="space-y-2 rounded-xl border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{claim.reason_label}</strong>
                <span className="text-xs text-slate-500">{CLAIM_STATUS_LABELS[claim.status]}</span>
              </div>
              <p className="text-slate-600">{claim.description}</p>
              {claim.partner_response ? (
                <p className="rounded-lg bg-slate-50 p-2">
                  <span className="font-semibold">Respuesta de la tienda:</span>{' '}
                  {claim.partner_response}
                </p>
              ) : null}
              {claim.resolution_note ? (
                <p className="text-xs text-slate-500">{claim.resolution_note}</p>
              ) : null}
              {['OPEN', 'PARTNER_RESPONDED'].includes(claim.status) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => withdrawOrderClaim(slug, orderId, claim.id, email),
                      'Reclamo cerrado',
                    )
                  }
                >
                  Ya se solucionó
                </Button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {hasActions ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="buyer-email">Email de la compra</Label>
            <Input
              id="buyer-email"
              type="email"
              className="min-h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="el que usaste al comprar"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {protection?.can_report_payment ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => simpleAction('payment-reported', 'Le avisamos a la tienda que pagaste')}
              >
                Ya pagué
              </Button>
            ) : null}
            {protection?.can_confirm_received ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => simpleAction('received', '¡Listo! Pedido marcado como recibido')}
              >
                Recibí mi pedido
              </Button>
            ) : null}
            {protection?.can_open_claim && !claimOpen ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => setClaimOpen(true)}>
                Tengo un problema con el pedido
              </Button>
            ) : null}
          </div>

          {claimOpen ? (
            <form onSubmit={onClaim} className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">¿Qué pasó?</legend>
                {CLAIM_REASONS.map((r) => (
                  <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="claim-reason"
                      checked={claimReason === r.value}
                      onChange={() => setClaimReason(r.value)}
                    />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <Textarea
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
                placeholder="Contanos qué pasó: fecha de pago, a qué cuenta transferiste, qué te respondió la tienda…"
                minLength={10}
                required
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  Enviar reclamo
                </Button>
                <Button type="button" variant="ghost" onClick={() => setClaimOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}

          {protection?.can_review ? (
            <form onSubmit={onReview} className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-semibold">Calificá a la tienda</p>
              <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} estrellas`}
                    className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-slate-300'}`}
                    onClick={() => setRating(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Cómo fue tu compra? (opcional)"
              />
              <Button type="submit" disabled={busy}>
                Enviar calificación
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {protection?.review ? (
        <p className="text-sm text-slate-600">
          Tu calificación: {'★'.repeat(protection.review.rating)}
          {protection.review.comment ? ` — ${protection.review.comment}` : ''}
        </p>
      ) : null}
    </div>
  );
}
