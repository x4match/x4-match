'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';

export default function ResumenPage() {
  const { activeSponsorId, activeSponsor } = useSponsor();
  const ordersQ = useQuery({
    queryKey: ['partner-orders', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/orders`)).data,
    enabled: !!activeSponsorId,
  });
  const payQ = useQuery({
    queryKey: ['partner-pay', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/payments/status`)).data,
    enabled: !!activeSponsorId,
  });

  const orders = ordersQ.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resumen</h1>
        <p className="text-slate-500">{activeSponsor?.name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Pedidos</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Mercado Pago</p>
          <p className="text-lg font-bold">{payQ.data?.mpEnabled ? 'Conectado' : 'No'}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">WhatsApp</p>
          <p className="text-lg font-bold">{payQ.data?.whatsappEnabled ? 'Activo' : 'No'}</p>
        </div>
      </div>
      {activeSponsor?.slug ? (
        <Link
          href={`/${activeSponsor.slug}`}
          className="inline-block text-sm font-semibold text-teal-700 underline"
          target="_blank"
        >
          Ver tienda pública
        </Link>
      ) : null}
    </div>
  );
}
