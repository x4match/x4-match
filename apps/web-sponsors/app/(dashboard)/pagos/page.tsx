'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function PagosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const statusQ = useQuery({
    queryKey: ['partner-pay', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/payments/status`)).data,
    enabled: !!activeSponsorId,
  });
  const [phone, setPhone] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!statusQ.data) return;
    setPhone(statusQ.data.whatsappPhone || '');
    setEnabled(!!statusQ.data.whatsappEnabled);
  }, [statusQ.data]);

  const connectMp = useMutation({
    mutationFn: async () =>
      (await api.post(`/sponsors/me/${activeSponsorId}/payments/mercadopago/connect`)).data,
    onSuccess: (data) => {
      if (data.authUrl) window.location.href = data.authUrl;
    },
  });

  const disconnectMp = useMutation({
    mutationFn: async () => api.post(`/sponsors/me/${activeSponsorId}/payments/mercadopago/disconnect`),
    onSuccess: () => {
      toast.success('MP desconectado');
      qc.invalidateQueries({ queryKey: ['partner-pay', activeSponsorId] });
    },
  });

  const saveWa = useMutation({
    mutationFn: async () =>
      api.patch(`/sponsors/me/${activeSponsorId}/payments/whatsapp`, { phone, enabled }),
    onSuccess: () => {
      toast.success('WhatsApp actualizado');
      qc.invalidateQueries({ queryKey: ['partner-pay', activeSponsorId] });
    },
  });

  function onWa(e: FormEvent) {
    e.preventDefault();
    saveWa.mutate();
  }

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-bold">Pagos</h1>
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Mercado Pago</h2>
        <p className="mt-1 text-sm text-slate-500">Estado: {statusQ.data?.mpStatus || '…'}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="rounded bg-teal-700 px-3 py-2 text-sm text-white" onClick={() => connectMp.mutate()}>
            Conectar MP
          </button>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => disconnectMp.mutate()}>
            Desconectar
          </button>
        </div>
      </section>
      <form onSubmit={onWa} className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">WhatsApp (pago manual)</h2>
        <input className="w-full rounded border px-3 py-2" placeholder="54911..." value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Habilitado
        </label>
        <button type="submit" className="rounded bg-teal-700 px-3 py-2 text-sm text-white">
          Guardar WhatsApp
        </button>
      </form>
    </div>
  );
}
