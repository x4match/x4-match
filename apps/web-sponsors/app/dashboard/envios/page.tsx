'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/PageShell';
import { FormSection } from '@/components/layout/FormSection';
import { DataTable, type DataTableColumn } from '@/components/layout/DataTable';

type Shipping = { id: string; name: string; type: string; price: number | string };

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
    onError: () => toast.error('No se pudo crear'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const items = (listQ.data || []) as Shipping[];
  const columns: DataTableColumn<Shipping>[] = [
    { key: 'name', header: 'Método', cell: (m) => <span className="font-semibold">{m.name}</span> },
    { key: 'type', header: 'Tipo', cell: (m) => m.type },
    {
      key: 'price',
      header: 'Precio',
      cell: (m) => `$${Number(m.price).toLocaleString('es-AR')}`,
    },
  ];

  return (
    <PageShell
      kicker="Ventas"
      title="Envíos"
      description="Retiro en local, tarifa fija o gratis sobre monto."
      variant="table"
    >
      <FormSection title="Agregar método">
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
          <Input
            className="min-h-11 min-w-[160px] flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="min-h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as 'PICKUP' | 'FLAT' | 'FREE_OVER')}
          >
            <option value="PICKUP">Retiro</option>
            <option value="FLAT">Tarifa fija</option>
            <option value="FREE_OVER">Gratis sobre monto</option>
          </select>
          <Input className="min-h-11 w-28" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Button type="submit" className="min-h-11 font-bold" disabled={create.isPending}>
            Agregar
          </Button>
        </form>
      </FormSection>
      <DataTable
        columns={columns}
        rows={items}
        loading={listQ.isLoading}
        empty="Sin métodos de envío."
      />
    </PageShell>
  );
}
