'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchOrder } from '@/lib/storefront-api';
import { formatMoney } from '@/lib/types';

export default function OrderPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const orderQ = useQuery({
    queryKey: ['order', slug, orderId],
    queryFn: () => fetchOrder(slug, orderId),
  });
  const order: any = orderQ.data;
  if (orderQ.isLoading) return <div className="p-8">Cargando…</div>;
  if (!order) return <div className="p-8">Pedido no encontrado</div>;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Pedido confirmado</h1>
      <p className="mt-2 text-slate-600">
        Estado: <strong>{order.status}</strong>
      </p>
      <p className="mt-1 text-lg font-bold text-teal-700">{formatMoney(Number(order.total))}</p>
      {order.status === 'AWAITING_MANUAL_PAYMENT' ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Coordiná el pago por WhatsApp. El partner confirmará tu pedido cuando reciba el pago.
        </p>
      ) : null}
      <ul className="mt-6 space-y-2">
        {(order.items || []).map((item: any) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.product_name} x{item.quantity}
            </span>
            <span>{formatMoney(Number(item.subtotal))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
