'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function ProductosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['partner-products', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/products`)).data,
    enabled: !!activeSponsorId,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    compareAtPrice: '',
    stockQuantity: '',
    photoUrl: '',
    status: 'ACTIVE',
  });

  const create = useMutation({
    mutationFn: async () =>
      api.post(`/sponsors/me/${activeSponsorId}/products`, {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : undefined,
        photoUrl: form.photoUrl || undefined,
        status: form.status,
      }),
    onSuccess: () => {
      toast.success('Producto creado');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['partner-products', activeSponsorId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button type="button" className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>
          Nuevo
        </button>
      </div>
      <div className="space-y-2">
        {(listQ.data || []).map((p: any) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-slate-500">
                ${Number(p.price).toLocaleString('es-AR')} · {p.status}
              </p>
            </div>
          </div>
        ))}
      </div>
      {open ? (
        <form onSubmit={onSubmit} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-2 rounded-xl bg-white p-4">
            <h2 className="font-bold">Nuevo producto</h2>
            {(['name', 'description', 'price', 'compareAtPrice', 'stockQuantity', 'photoUrl'] as const).map((k) => (
              <input
                key={k}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder={k}
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                required={k === 'name' || k === 'price'}
              />
            ))}
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-teal-700 px-3 py-2 text-sm text-white">
                Guardar
              </button>
              <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
