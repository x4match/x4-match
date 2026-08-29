'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  clubPaymentStatusLabel,
  clubPaymentStatusTone,
  type ClubPaymentConfigStatus,
} from '@/lib/club-payments';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function statusBadgeClass(tone: ReturnType<typeof clubPaymentStatusTone>) {
  switch (tone) {
    case 'success':
      return 'bg-success/15 text-success';
    case 'warning':
      return 'bg-warning/15 text-warning';
    case 'danger':
      return 'bg-destructive/15 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function PagosPage() {
  const { activeClubId, activeClub, clubsLoading } = useClub();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const statusQuery = useQuery({
    queryKey: ['club-mp-status', activeClubId],
    queryFn: async () => {
      const res = await api.get<ClubPaymentConfigStatus>(`/clubs/${activeClubId}/payments/status`);
      return res.data;
    },
    enabled: !!activeClubId,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['club-mp-status', activeClubId] });
    await queryClient.invalidateQueries({ queryKey: ['club-trial-status', activeClubId] });
    await queryClient.invalidateQueries({ queryKey: ['club-manager-report', activeClubId] });
  };

  useEffect(() => {
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    if (status === 'connected') {
      void invalidate();
      toast.success('Cuenta vinculada correctamente.');
    } else if (status === 'error') {
      toast.error(message ? decodeURIComponent(message) : 'No se pudo vincular la cuenta.');
    }
  }, [searchParams]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ authUrl: string }>(
        `/clubs/${activeClubId}/payments/oauth/start`,
        { returnTo: 'web' },
      );
      return res.data;
    },
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo iniciar la vinculación.');
    },
  });

  const mockConnectMutation = useMutation({
    mutationFn: async () => api.post(`/clubs/${activeClubId}/payments/mock-connect`),
    onSuccess: async () => {
      await invalidate();
      toast.success('Cuenta vinculada en modo demo.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo vincular la cuenta.');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => api.delete(`/clubs/${activeClubId}/payments/disconnect`),
    onSuccess: async () => {
      await invalidate();
      toast.success('Cuenta desvinculada.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo desvincular.');
    },
  });

  const modeMutation = useMutation({
    mutationFn: async (mode: 'online' | 'manual') =>
      api.patch(`/clubs/${activeClubId}/payments/mode`, { mode }),
    onSuccess: async () => {
      await invalidate();
      toast.success('Modo de cobro actualizado.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo actualizar el modo.');
    },
  });

  if (clubsLoading) return <DashboardSkeleton />;

  if (!activeClubId) {
    return (
      <EmptyState
        title="Sin clubes"
        description="No tenés clubs asignados para configurar pagos."
      />
    );
  }

  if (statusQuery.isLoading) return <DashboardSkeleton />;

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <EmptyState
        title="No se pudo cargar pagos"
        description="Reintentá en unos segundos."
      />
    );
  }

  const paymentStatus = statusQuery.data;
  const status = paymentStatus.status;
  const tone = clubPaymentStatusTone(status);
  const canConnectOAuth = paymentStatus.oauthConfigured && status !== 'CONNECTED';
  const canMockConnect = paymentStatus.mockConnectAvailable && status !== 'CONNECTED';

  return (
    <div className="space-y-6">
      <PageHeader title="Pagos" subtitle={activeClub?.name || 'Club'} />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
            <Wallet className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold">Mercado Pago</p>
            <p className="text-sm text-muted-foreground">
              Estado: {clubPaymentStatusLabel(status)}
            </p>
          </div>
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusBadgeClass(tone))}>
            {clubPaymentStatusLabel(status)}
          </span>
        </CardContent>
      </Card>

      {paymentStatus.mpUserId ? (
        <p className="text-sm text-muted-foreground">
          Cuenta ·•••{paymentStatus.mpUserId.slice(-4)}
          {paymentStatus.connectedAt
            ? ` · vinculada ${new Date(paymentStatus.connectedAt).toLocaleDateString('es-AR')}`
            : ''}
        </p>
      ) : null}

      {!paymentStatus.oauthConfigured && !paymentStatus.mockConnectAvailable && status !== 'CONNECTED' ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            La vinculación con Mercado Pago se habilitará desde x4 match. Si necesitás activarla
            antes, contactá a soporte.
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canConnectOAuth ? (
          <Button
            className="rounded-xl"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
          >
            <CreditCard className="size-4" />
            Vincular Mercado Pago
          </Button>
        ) : null}
        {canMockConnect ? (
          <Button
            className="rounded-xl"
            onClick={() => mockConnectMutation.mutate()}
            disabled={mockConnectMutation.isPending}
          >
            <CreditCard className="size-4" />
            Vincular cuenta (demo)
          </Button>
        ) : null}
        {status === 'CONNECTED' || status === 'EXPIRED' ? (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              if (window.confirm('¿Desvincular la cuenta de Mercado Pago?')) {
                disconnectMutation.mutate();
              }
            }}
            disabled={disconnectMutation.isPending}
          >
            Desvincular
          </Button>
        ) : null}
        {status === 'EXPIRED' && paymentStatus.oauthConfigured ? (
          <Button
            className="rounded-xl"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
          >
            Reconectar
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => modeMutation.mutate('manual')}
          disabled={modeMutation.isPending}
        >
          Cobro en recepción
        </Button>
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => modeMutation.mutate('online')}
          disabled={modeMutation.isPending || status !== 'CONNECTED'}
        >
          Cobro online
        </Button>
      </div>
    </div>
  );
}
