'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  EmptyHint,
  ListRow,
  PageShell,
  PanelCard,
  StatusPill,
} from '@/components/layout/PageShell';

type Order = {
  id: string;
  buyer_name?: string;
  buyer_email?: string;
  total: number | string;
  status: string;
  payment_method?: string;
};

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'PAID' || status === 'FULFILLED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'AWAITING_MANUAL_PAYMENT') return 'warning';
  return 'neutral';
}

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
    onError: () => toast.error('No se pudo actualizar el pedido'),
  });

  const orders = (listQ.data || []) as Order[];

  return (
    <PageShell
      kicker="Ventas"
      title="Pedidos"
      description="Confirmá pagos y marcá pedidos como cumplidos."
    >
      <PanelCard>
        {listQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando pedidos…</p>
        ) : orders.length === 0 ? (
          <EmptyHint>Todavía no hay pedidos en esta tienda.</EmptyHint>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <ListRow
                key={o.id}
                title={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {o.buyer_name || 'Cliente'}
                    <StatusPill tone={statusTone(o.status)}>{o.status}</StatusPill>
                  </span>
                }
                meta={`${o.buyer_email || '—'} · $${Number(o.total).toLocaleString('es-AR')} · ${o.payment_method || '—'}`}
                actions={
                  <>
                    {o.status === 'AWAITING_MANUAL_PAYMENT' ? (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-10 font-semibold"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: o.id, status: 'PAID' })}
                      >
                        Confirmar pago
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: o.id, status: 'FULFILLED' })}
                    >
                      Cumplido
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-10 text-destructive hover:text-destructive"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: o.id, status: 'CANCELLED' })}
                    >
                      Cancelar
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </PanelCard>
    </PageShell>
  );
}
