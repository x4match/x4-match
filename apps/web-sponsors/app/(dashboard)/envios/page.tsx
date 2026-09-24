'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function EnviosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['partner-shipping', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/shipping`)).data,
    enabled: !!activeSponsorId,
  });
  const [name, setName] = useState('Envío estándar');
  const [type, setType] = useState<'PICKUP' | 'FLAT' | 'FREE_OVER'>('FLAT');
  const [price, setPrice] = useState('5000');

  const create = useMutation({
    mutationFn: async () =>
      api.post(`/sponsors/me/${activeSponsorId}/shipping`, {
        name,
        type,
        price: Number(price),
        minOrder: type === 'FREE_OVER' ? Number(price) : undefined,
      }),
    onSuccess: () => {
      toast.success('Método creado');
      qc.invalidateQueries({ queryKey: ['partner-shipping', activeSponsorId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Envíos</h1>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input className="rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="rounded border px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="PICKUP">Retiro</option>
          <option value="FLAT">Tarifa fija</option>
          <option value="FREE_OVER">Gratis sobre monto</option>
        </select>
        <input className="w-28 rounded border px-3 py-2" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-white">
          Agregar
        </button>
      </form>
      <ul className="space-y-2">
        {(listQ.data || []).map((m: any) => (
          <li key={m.id} className="rounded border bg-white px-3 py-2 text-sm">
            {m.name} · {m.type} · ${Number(m.price).toLocaleString('es-AR')}
          </li>
        ))}
      </ul>
    </div>
  );
}
