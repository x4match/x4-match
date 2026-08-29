'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useClub } from '@/contexts/ClubContext';
import {
  downloadRevenueCsv,
  isMovementCollected,
  type ClubRevenueResponse,
  type RevenueMovement,
} from '@/lib/club-revenue';
import { confirmShopPurchase, markDepositPaid } from '@/lib/shop-api';
import { formatCurrency } from '@/lib/currency';
import { formatFullDate } from '@/lib/format';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Period = 7 | 30 | 90;

export default function FacturacionPage() {
  const { activeClubId, activeClub } = useClub();
  const [period, setPeriod] = useState<Period>(30);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['club-billing-movements', activeClubId, period],
    queryFn: async () => {
      const res = await api.get<ClubRevenueResponse>(`/clubs/${activeClubId}/revenue`, {
        params: { days: period, movementsLimit: 500 },
      });
      return res.data;
    },
    enabled: !!activeClubId,
  });

  const markPaid = useMutation({
    mutationFn: async (item: RevenueMovement) => {
      if (!activeClubId) throw new Error('Club inválido');
      if (item.kind === 'shop') return confirmShopPurchase(activeClubId, item.id);
      return markDepositPaid(activeClubId, item.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-billing-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['club-manager-report'] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-stats'] }),
      ]);
      toast.success('Cobro registrado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo registrar el cobro');
    },
  });

  if (!activeClubId) return <EmptyState title="Seleccioná un club" />;
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return <EmptyState title="No se pudo cargar la facturación" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        subtitle={activeClub?.name}
        actions={
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              downloadRevenueCsv({
                clubName: activeClub?.name || 'club',
                periodDays: period,
                summary: data.summary,
                movements: data.recent,
              })
            }
          >
            Exportar CSV
          </Button>
        }
      />

      <div className="flex gap-2">
        {([7, 30, 90] as Period[]).map((d) => (
          <Button
            key={d}
            variant={period === d ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl"
            onClick={() => setPeriod(d)}
          >
            {d} días
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Cobrado', value: data.summary.totalCollected },
          { label: 'Pendiente', value: data.summary.totalPending },
          { label: 'Señas cobradas', value: data.summary.collectedDeposits },
          { label: 'Tienda cobrada', value: data.summary.collectedShop },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(kpi.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {data.recent.map((item) => {
          const collected = isMovementCollected(item.status);
          return (
            <Card key={`${item.kind}-${item.id}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{item.label}</p>
                    <Badge variant="secondary">{item.kind === 'shop' ? 'Tienda' : 'Seña'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.userName} · {formatFullDate(item.occurredAt)}
                    {item.courtLabel ? ` · ${item.courtLabel}` : ''}
                    {item.provider ? ` · ${item.provider}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      'text-lg font-bold tabular-nums',
                      collected ? 'text-success' : 'text-warning',
                    )}
                  >
                    {formatCurrency(item.amount)}
                  </p>
                  {!collected && item.checkoutUrl ? (
                    <Button size="sm" variant="outline" className="rounded-xl" asChild>
                      <a href={item.checkoutUrl} target="_blank" rel="noreferrer">
                        Abrir link MP
                      </a>
                    </Button>
                  ) : null}
                  {!collected ? (
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={markPaid.isPending}
                      onClick={() => markPaid.mutate(item)}
                    >
                      Confirmar cobro
                    </Button>
                  ) : (
                    <Badge className="bg-success/15 text-success">Cobrado</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!data.recent.length ? (
          <EmptyState title="Sin movimientos" description="No hay cobros en este período." />
        ) : null}
      </div>
    </div>
  );
}
