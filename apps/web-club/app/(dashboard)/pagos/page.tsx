'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, CreditCard, Wallet } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      toast.success('Mercado Pago conectado correctamente.');
    } else if (status === 'error') {
      toast.error(message ? decodeURIComponent(message) : 'No se pudo conectar Mercado Pago.');
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
      toast.error(err.response?.data?.message || 'No se pudo iniciar la conexión.');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => api.delete(`/clubs/${activeClubId}/payments/disconnect`),
    onSuccess: async () => {
      await invalidate();
      toast.success('Mercado Pago desconectado.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo desconectar.');
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos"
        subtitle={`Mercado Pago · ${activeClub?.name || 'Club'}`}
      />

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
            <Wallet className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold">Mercado Pago del club</p>
            <p className="text-sm text-muted-foreground">
              La plata de jugadores va directo a tu cuenta. x4 match no la recibe.
            </p>
          </div>
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusBadgeClass(tone))}>
            {clubPaymentStatusLabel(status)}
          </span>
        </CardContent>
      </Card>

      {paymentStatus.mpUserId ? (
        <p className="text-sm text-muted-foreground">
          Cuenta MP ·•••{paymentStatus.mpUserId.slice(-4)}
          {paymentStatus.connectedAt
            ? ` · conectada ${new Date(paymentStatus.connectedAt).toLocaleDateString('es-AR')}`
            : ''}
        </p>
      ) : null}

      {status !== 'CONNECTED' ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Conectá Mercado Pago para cobrar señas online. Sin conexión, los jugadores pueden pagar
            en recepción y vos registrás el cobro en Facturación.
          </CardContent>
        </Card>
      ) : null}

      {paymentStatus.usesPlatformFallback ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Modo transición: los cobros usan la cuenta de plataforma hasta que conectes la tuya.
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status !== 'CONNECTED' && paymentStatus.oauthConfigured ? (
          <Button
            className="rounded-xl"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
          >
            <CreditCard className="size-4" />
            Conectar Mercado Pago
          </Button>
        ) : null}
        {status === 'CONNECTED' ? (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              if (window.confirm('Los jugadores no podrán pagar online hasta que vuelvas a conectar.')) {
                disconnectMutation.mutate();
              }
            }}
            disabled={disconnectMutation.isPending}
          >
            Desconectar
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => modeMutation.mutate('manual')}
          disabled={modeMutation.isPending}
        >
          Modo manual
        </Button>
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => modeMutation.mutate('online')}
          disabled={modeMutation.isPending || status !== 'CONNECTED'}
        >
          Modo online
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {[
            'El jugador paga la seña con Mercado Pago del club.',
            'x4 match solo registra el estado (cobrado / pendiente).',
            'La suscripción de x4 match se cobra aparte, nunca mezclada.',
          ].map((line) => (
            <div key={line} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{line}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
