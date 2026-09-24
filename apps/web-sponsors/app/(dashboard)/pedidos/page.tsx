'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function PedidosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['partner-orders', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/orders`)).data,
    enabled: !!activeSponsorId,
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.patch(`/sponsors/me/${activeSponsorId}/orders/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Pedido actualizado');
      qc.invalidateQueries({ queryKey: ['partner-orders', activeSponsorId] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <div className="space-y-2">
        {(listQ.data || []).map((o: any) => (
          <div key={o.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{o.buyer_name || 'Cliente'}</p>
                <p className="text-sm text-slate-500">
                  {o.buyer_email} · ${Number(o.total).toLocaleString('es-AR')} · {o.status} ·{' '}
                  {o.payment_method || '—'}
                </p>
              </div>
              <div className="flex gap-2">
                {o.status === 'AWAITING_MANUAL_PAYMENT' ? (
                  <button
                    type="button"
                    className="rounded bg-green-600 px-3 py-1.5 text-xs text-white"
                    onClick={() => update.mutate({ id: o.id, status: 'PAID' })}
                  >
                    Confirmar pago
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-xs"
                  onClick={() => update.mutate({ id: o.id, status: 'FULFILLED' })}
                >
                  Cumplido
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-xs text-red-600"
                  onClick={() => update.mutate({ id: o.id, status: 'CANCELLED' })}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
