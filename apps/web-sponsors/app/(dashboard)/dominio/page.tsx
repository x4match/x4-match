'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function DominioPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const sponsorQ = useQuery({
    queryKey: ['partner-sponsor', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}`)).data,
    enabled: !!activeSponsorId,
  });
  const [domain, setDomain] = useState('');
  const [dns, setDns] = useState<any>(null);

  const setDomainMut = useMutation({
    mutationFn: async () =>
      (await api.post(`/sponsors/me/${activeSponsorId}/domain`, { domain })).data,
    onSuccess: (data) => {
      setDns(data.dns_instructions);
      toast.success('Dominio guardado — verificá el DNS');
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error'),
  });

  const verify = useMutation({
    mutationFn: async () => api.post(`/sponsors/me/${activeSponsorId}/domain/verify`),
    onSuccess: () => {
      toast.success('Dominio verificado');
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'DNS no verificado'),
  });

  const remove = useMutation({
    mutationFn: async () => api.delete(`/sponsors/me/${activeSponsorId}/domain`),
    onSuccess: () => {
      toast.success('Dominio quitado');
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
    },
  });

  const s = sponsorQ.data;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setDomainMut.mutate();
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Dominio</h1>
      <p className="text-sm text-slate-600">
        URL default:{' '}
        <a className="text-teal-700 underline" href={s?.store_url} target="_blank" rel="noreferrer">
          {s?.store_url || `…/${s?.slug}`}
        </a>
      </p>
      <p className="text-sm">
        Dominio propio: {s?.custom_domain || '—'} ({s?.custom_domain_status || 'NONE'})
      </p>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="tienda.tudominio.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          required
        />
        <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-white">
          Guardar
        </button>
      </form>
      {dns ? (
        <div className="rounded border bg-slate-50 p-3 text-sm">
          <p>CNAME → {dns.cname}</p>
          <p>TXT → {dns.txt}</p>
        </div>
      ) : null}
      <div className="flex gap-2">
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => verify.mutate()}>
          Verificar DNS
        </button>
        <button type="button" className="rounded border px-3 py-2 text-sm text-red-600" onClick={() => remove.mutate()}>
          Quitar dominio
        </button>
      </div>
    </div>
  );
}
