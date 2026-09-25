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

type Category = { id: string; name: string; slug: string };

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
    onError: () => toast.error('No se pudo crear'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const items = (listQ.data || []) as Category[];
  const columns: DataTableColumn<Category>[] = [
    { key: 'name', header: 'Nombre', cell: (c) => <span className="font-semibold">{c.name}</span> },
    { key: 'slug', header: 'Slug', cell: (c) => <span className="font-mono text-xs">/{c.slug}</span> },
  ];

  return (
    <PageShell
      kicker="Catálogo"
      title="Categorías"
      description="Organizá productos para la navegación de la tienda."
      variant="table"
    >
      <FormSection title="Nueva categoría">
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="min-h-11 flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de categoría"
            required
          />
          <Button type="submit" className="min-h-11 font-bold" disabled={create.isPending}>
            Agregar
          </Button>
        </form>
      </FormSection>
      <DataTable
        columns={columns}
        rows={items}
        loading={listQ.isLoading}
        empty="Sin categorías todavía."
      />
    </PageShell>
  );
}
