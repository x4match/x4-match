'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EmptyHint,
  ListRow,
  PageShell,
  PanelCard,
} from '@/components/layout/PageShell';

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

  const items = (listQ.data || []) as Array<{ id: string; name: string; slug: string }>;

  return (
    <PageShell
      kicker="Catálogo"
      title="Categorías"
      description="Organizá productos para la navegación de la tienda."
    >
      <PanelCard>
        <form onSubmit={onSubmit} className="mb-4 flex flex-col gap-2 sm:flex-row">
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
        {listQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <EmptyHint>Sin categorías todavía.</EmptyHint>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <ListRow key={c.id} title={c.name} meta={`/${c.slug}`} />
            ))}
          </div>
        )}
      </PanelCard>
    </PageShell>
  );
}
