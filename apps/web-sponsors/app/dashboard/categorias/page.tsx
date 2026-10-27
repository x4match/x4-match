'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/PageShell';
import { FormSection } from '@/components/layout/FormSection';
import { DataTable, type DataTableColumn } from '@/components/layout/DataTable';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';

type Category = { id: string; name: string; slug: string; product_count?: number };

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
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/sponsors/me/${activeSponsorId}/categories/${id}`),
    onSuccess: () => {
      toast.success('Categoría eliminada');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['partner-cats', activeSponsorId] });
      qc.invalidateQueries({ queryKey: ['partner-products', activeSponsorId] });
    },
    onError: () => toast.error('No se pudo eliminar la categoría'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const items = (listQ.data || []) as Category[];
  const columns: DataTableColumn<Category>[] = [
    { key: 'name', header: 'Nombre', cell: (c) => <span className="font-semibold">{c.name}</span> },
    { key: 'slug', header: 'Slug', cell: (c) => <span className="font-mono text-xs">/{c.slug}</span> },
    {
      key: 'products',
      header: 'Productos',
      className: 'w-28 text-right',
      cell: (c) => (c.product_count != null ? c.product_count : '—'),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28 text-right',
      cell: (c) => (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="gap-1.5"
          aria-label={`Eliminar categoría ${c.name}`}
          onClick={() => setToDelete(c)}
        >
          <Trash2 className="size-3.5" aria-hidden />
          Eliminar
        </Button>
      ),
    },
  ];
  const affected = toDelete?.product_count ?? 0;

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
        empty={listQ.isError ? 'No se pudieron cargar las categorías.' : 'Sin categorías todavía.'}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`¿Eliminar "${toDelete?.name ?? ''}"?`}
        description={
          affected === 1
            ? 'El producto de esta categoría no se borra: queda sin categoría y sigue en tu catálogo.'
            : affected > 1
              ? `Los ${affected} productos de esta categoría no se borran: quedan sin categoría y siguen en tu catálogo.`
              : 'La categoría se quita de la navegación de tu tienda.'
        }
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </PageShell>
  );
}
