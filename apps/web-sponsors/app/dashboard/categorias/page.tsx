'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function CategoriasPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['partner-cats', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/categories`)).data,
    enabled: !!activeSponsorId,
  });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: async () => api.post(`/sponsors/me/${activeSponsorId}/categories`, { name }),
    onSuccess: () => {
      setName('');
      toast.success('Categoría creada');
      qc.invalidateQueries({ queryKey: ['partner-cats', activeSponsorId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categorías</h1>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input className="flex-1 rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required />
        <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-white">
          Agregar
        </button>
      </form>
      <ul className="space-y-2">
        {(listQ.data || []).map((c: any) => (
          <li key={c.id} className="rounded border bg-white px-3 py-2">
            {c.name} <span className="text-xs text-slate-400">/{c.slug}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
