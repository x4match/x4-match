'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

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
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'No se pudo conectar Mercado Pago');
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
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'No se pudo desconectar');
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
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'No se pudo guardar WhatsApp');
    },
  });

  function onWa(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    saveWa.mutate();
  }

  if (sponsorsLoading) {
    return <p className="text-sm text-slate-500">Cargando tienda…</p>;
  }

  if (!ready) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <p className="text-sm text-slate-600">
          {sponsors.length === 0
            ? 'Tu usuario PARTNER no tiene una tienda asignada. Pedile a ops que te vincule desde web-admin.'
            : 'No hay una tienda activa seleccionada.'}
        </p>
      </div>
    );
  }

  const busy = connectMp.isPending || disconnectMp.isPending || saveWa.isPending;

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-bold">Pagos</h1>
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Mercado Pago</h2>
        <p className="mt-1 text-sm text-slate-500">
          Estado: {statusQ.isLoading ? '…' : statusQ.data?.mpStatus || 'DISCONNECTED'}
        </p>
        {!statusQ.data?.oauthConfigured ? (
          <p className="mt-2 text-sm text-amber-700">
            OAuth de Mercado Pago no está configurado en el servidor (MP_APP_ID / secret).
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy || !statusQ.data?.oauthConfigured}
            className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={() => connectMp.mutate()}
          >
            {connectMp.isPending ? 'Redirigiendo…' : 'Conectar MP'}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => disconnectMp.mutate()}
          >
            Desconectar
          </button>
        </div>
      </section>
      <form onSubmit={onWa} className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">WhatsApp (pago manual)</h2>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="54911..."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Habilitado
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Guardar WhatsApp
        </button>
      </form>
    </div>
  );
}
