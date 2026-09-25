'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { PageShell, StatusPill } from '@/components/layout/PageShell';
import { FormSection } from '@/components/layout/FormSection';

export default function PagosPage() {
  const { activeSponsorId, sponsorsLoading, sponsors } = useSponsor();
  const qc = useQueryClient();
  const ready = !!activeSponsorId;
  const statusQ = useQuery({
    queryKey: ['partner-pay', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/payments/status`)).data,
    enabled: ready,
  });
  const [phone, setPhone] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!statusQ.data) return;
    setPhone(statusQ.data.whatsappPhone || '');
    setEnabled(!!statusQ.data.whatsappEnabled);
  }, [statusQ.data]);

  const connectMp = useMutation({
    mutationFn: async () => {
      if (!activeSponsorId) throw new Error('Sin tienda activa');
      return (await api.post(`/sponsors/me/${activeSponsorId}/payments/mercadopago/connect`)).data;
    },
    onSuccess: (data) => {
      if (data.authUrl) window.location.href = data.authUrl;
      else toast.error('No se recibió la URL de Mercado Pago');
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
          (err as { message?: string })?.message ||
          'No se pudo conectar Mercado Pago',
      );
    },
  });

  const disconnectMp = useMutation({
    mutationFn: async () => {
      if (!activeSponsorId) throw new Error('Sin tienda activa');
      return api.post(`/sponsors/me/${activeSponsorId}/payments/mercadopago/disconnect`);
    },
    onSuccess: () => {
      toast.success('MP desconectado');
      qc.invalidateQueries({ queryKey: ['partner-pay', activeSponsorId] });
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'No se pudo desconectar',
      );
    },
  });

  const saveWa = useMutation({
    mutationFn: async () => {
      if (!activeSponsorId) throw new Error('Sin tienda activa');
      return api.patch(`/sponsors/me/${activeSponsorId}/payments/whatsapp`, { phone, enabled });
    },
    onSuccess: () => {
      toast.success('WhatsApp actualizado');
      qc.invalidateQueries({ queryKey: ['partner-pay', activeSponsorId] });
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'No se pudo guardar WhatsApp',
      );
    },
  });

  function onWa(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    saveWa.mutate();
  }

  if (sponsorsLoading) {
    return <p className="text-sm text-muted-foreground">Cargando tienda…</p>;
  }

  if (!ready) {
    return (
      <PageShell kicker="Ventas" title="Pagos" description="Conectá cobros para tu tienda.">
        <FormSection>
          <p className="text-sm text-muted-foreground">
            {sponsors.length === 0
              ? 'Tu usuario PARTNER no tiene una tienda asignada. Pedile a ops que te vincule desde web-admin.'
              : 'No hay una tienda activa seleccionada.'}
          </p>
        </FormSection>
      </PageShell>
    );
  }

  const busy = connectMp.isPending || disconnectMp.isPending || saveWa.isPending;
  const mpStatus = statusQ.isLoading ? '…' : statusQ.data?.mpStatus || 'DISCONNECTED';
  const mpConnected = String(mpStatus).toUpperCase() === 'CONNECTED' || !!statusQ.data?.mpEnabled;
  const waReady = !!statusQ.data?.whatsappEnabled && !!phone;
  const checklist = [
    { done: !!statusQ.data?.oauthConfigured, label: 'OAuth MP configurado en servidor' },
    { done: mpConnected, label: 'Cuenta Mercado Pago conectada' },
    { done: waReady, label: 'WhatsApp habilitado con teléfono' },
  ];
  const pct = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  return (
    <PageShell
      kicker="Ventas"
      title="Pagos"
      description="Mercado Pago y WhatsApp para cobros."
      variant="form"
    >
      <FormSection title="Estado de cobros" description="Checklist de conexión">
        <Progress value={pct} className="mb-4 h-2" />
        <ul className="mb-2 space-y-2">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              {c.done ? (
                <CheckCircle2 className="size-4 text-success" aria-hidden />
              ) : (
                <Circle className="size-4 text-muted-foreground" aria-hidden />
              )}
              {c.label}
            </li>
          ))}
        </ul>
      </FormSection>

      <FormSection
        title="Mercado Pago"
        description="Conectá tu cuenta para cobrar online en la tienda."
        actions={<StatusPill tone={mpConnected ? 'success' : 'warning'}>{mpStatus}</StatusPill>}
      >
        {!statusQ.data?.oauthConfigured ? (
          <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            OAuth de Mercado Pago no está configurado en el servidor (MP_APP_ID / secret).
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11 font-bold"
            disabled={busy || !statusQ.data?.oauthConfigured}
            onClick={() => connectMp.mutate()}
          >
            {connectMp.isPending ? 'Redirigiendo…' : 'Conectar MP'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => disconnectMp.mutate()}
          >
            Desconectar
          </Button>
        </div>
      </FormSection>

      <form onSubmit={onWa}>
        <FormSection
          title="WhatsApp (pago manual)"
          description="Los clientes pueden coordinar el pago por chat."
          actions={
            <StatusPill tone={waReady ? 'success' : 'neutral'}>
              {enabled ? 'Habilitado' : 'Off'}
            </StatusPill>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wa-phone">Teléfono</Label>
              <Input
                id="wa-phone"
                className="min-h-11"
                placeholder="54911..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Habilitado
            </label>
            <Button type="submit" className="min-h-11 font-bold" disabled={busy}>
              {saveWa.isPending ? 'Guardando…' : 'Guardar WhatsApp'}
            </Button>
          </div>
        </FormSection>
      </form>
    </PageShell>
  );
}
