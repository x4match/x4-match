'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PageShell, StatusPill } from '@/components/layout/PageShell';
import { DataTable, type DataTableColumn } from '@/components/layout/DataTable';

type Order = {
  id: string;
  buyer_name?: string;
  buyer_email?: string;
  total: number | string;
  status: string;
  payment_method?: string;
  buyer_reported_paid_at?: string | null;
  delivery_deadline_at?: string | null;
  received_at?: string | null;
  tracking_note?: string | null;
  has_open_claim?: boolean;
};

function shortDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '';
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'PAID' || status === 'FULFILLED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'AWAITING_MANUAL_PAYMENT') return 'warning';
  return 'neutral';
}

export default function PedidosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Order | null>(null);
  const [trackingNote, setTrackingNote] = useState('');
  const listQ = useQuery({
    queryKey: ['partner-orders', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/orders`)).data,
    enabled: !!activeSponsorId,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      status,
      trackingNote,
    }: {
      id: string;
      status: string;
      trackingNote?: string;
    }) =>
      api.patch(`/sponsors/me/${activeSponsorId}/orders/${id}/status`, {
        status,
        trackingNote: trackingNote?.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Pedido actualizado');
      setSelected(null);
      setTrackingNote('');
      qc.invalidateQueries({ queryKey: ['partner-orders', activeSponsorId] });
    },
    onError: (err: unknown) =>
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'No se pudo actualizar el pedido',
      ),
  });

  const orders = (listQ.data || []) as Order[];

  const columns: DataTableColumn<Order>[] = [
    {
      key: 'buyer',
      header: 'Cliente',
      cell: (o) => (
        <div>
          <p className="font-semibold">{o.buyer_name || 'Cliente'}</p>
          <p className="text-xs text-muted-foreground">{o.buyer_email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      cell: (o) => `$${Number(o.total).toLocaleString('es-AR')}`,
    },
    {
      key: 'payment',
      header: 'Pago',
      cell: (o) => o.payment_method || '—',
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (o) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill tone={statusTone(o.status)}>{o.status}</StatusPill>
          {o.has_open_claim ? <StatusPill tone="danger">Reclamo abierto</StatusPill> : null}
          {o.status === 'AWAITING_MANUAL_PAYMENT' && o.buyer_reported_paid_at ? (
            <span className="text-xs text-amber-700">Cliente avisó que pagó</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'deadline',
      header: 'Entregar antes de',
      cell: (o) =>
        o.received_at ? (
          <span className="text-xs text-emerald-700">Recibido</span>
        ) : o.delivery_deadline_at ? (
          <span
            className={
              new Date(o.delivery_deadline_at) < new Date() ? 'font-semibold text-destructive' : ''
            }
          >
            {shortDate(o.delivery_deadline_at)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (o) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Acciones"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {o.status === 'AWAITING_MANUAL_PAYMENT' ? (
              <DropdownMenuItem onClick={() => update.mutate({ id: o.id, status: 'PAID' })}>
                Confirmar pago
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => update.mutate({ id: o.id, status: 'FULFILLED' })}>
              Marcar cumplido
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => update.mutate({ id: o.id, status: 'CANCELLED' })}
            >
              Cancelar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelected(o)}>Ver detalle</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <PageShell
      kicker="Ventas"
      title="Pedidos"
      description="Confirmá pagos y marcá pedidos como enviados antes del plazo. Si vence sin envío, se abre un reclamo automático."
      variant="table"
    >
      <DataTable
        columns={columns}
        rows={orders}
        loading={listQ.isLoading}
        empty="Todavía no hay pedidos en esta tienda."
        onRowClick={(o) => setSelected(o)}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.buyer_name || 'Pedido'}</SheetTitle>
            <SheetDescription>{selected?.buyer_email}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="mt-6 space-y-4 px-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">${Number(selected.total).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estado</span>
                <StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Método</span>
                <span>{selected.payment_method || '—'}</span>
              </div>
              {selected.delivery_deadline_at && !selected.received_at ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Entregar antes de</span>
                  <span>{shortDate(selected.delivery_deadline_at)}</span>
                </div>
              ) : null}
              {selected.has_open_claim ? (
                <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                  Este pedido tiene un reclamo abierto. Respondelo desde Reclamos.
                </p>
              ) : null}
              <div className="space-y-2">
                <label htmlFor="tracking" className="text-sm text-muted-foreground">
                  Seguimiento del envío (lo ve el cliente)
                </label>
                <Input
                  id="tracking"
                  value={trackingNote}
                  placeholder={selected.tracking_note || 'Ej: Correo Argentino CP123456789AR'}
                  onChange={(e) => setTrackingNote(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 pt-4">
                {selected.status === 'AWAITING_MANUAL_PAYMENT' ? (
                  <Button
                    className="min-h-11 font-bold"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: selected.id, status: 'PAID' })}
                  >
                    Confirmar pago
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({ id: selected.id, status: 'FULFILLED', trackingNote })
                  }
                >
                  Marcar enviado / entregado
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11 text-destructive"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: selected.id, status: 'CANCELLED' })}
                >
                  Cancelar pedido
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
