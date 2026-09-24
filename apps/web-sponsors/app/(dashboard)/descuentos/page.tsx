'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function DescuentosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['partner-coupons', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/coupons`)).data,
    enabled: !!activeSponsorId,
  });
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('');
  const create = useMutation({
    mutationFn: async () =>
      api.post(`/sponsors/me/${activeSponsorId}/coupons`, {
        code,
        discountPercent: Number(percent),
      }),
    onSuccess: () => {
      setCode('');
      setPercent('');
      toast.success('Cupón creado');
      qc.invalidateQueries({ queryKey: ['partner-coupons', activeSponsorId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Descuentos</h1>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input className="rounded border px-3 py-2" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input className="w-24 rounded border px-3 py-2" placeholder="%" value={percent} onChange={(e) => setPercent(e.target.value)} required />
        <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-white">
          Crear
        </button>
      </form>
      <ul className="space-y-2">
        {(listQ.data || []).map((c: any) => (
          <li key={c.id} className="rounded border bg-white px-3 py-2 text-sm">
            {c.code} · {c.discount_percent ? `${c.discount_percent}%` : `$${c.discount_amount}`} ·{' '}
            {c.active ? 'activo' : 'inactivo'}
          </li>
        ))}
      </ul>
    </div>
  );
}
