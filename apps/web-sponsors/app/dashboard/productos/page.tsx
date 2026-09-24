'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  EmptyHint,
  ListRow,
  PageShell,
  PanelCard,
  StatusPill,
} from '@/components/layout/PageShell';

type Product = {
  id: string;
  name: string;
  price: number | string;
  status: string;
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  description: 'Descripción',
  price: 'Precio',
  compareAtPrice: 'Precio comparado',
  stockQuantity: 'Stock',
  photoUrl: 'URL de foto',
};

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
      setForm({
        name: '',
        description: '',
        price: '',
        compareAtPrice: '',
        stockQuantity: '',
        photoUrl: '',
        status: 'ACTIVE',
      });
      qc.invalidateQueries({ queryKey: ['partner-products', activeSponsorId] });
    },
    onError: () => toast.error('No se pudo crear el producto'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const products = (listQ.data || []) as Product[];

  return (
    <PageShell
      kicker="Catálogo"
      title="Productos"
      description="Publicá y gestioná el inventario de tu tienda."
      actions={
        <Button type="button" className="min-h-11 gap-2 font-bold" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nuevo
        </Button>
      }
    >
      <PanelCard>
        {listQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando productos…</p>
        ) : products.length === 0 ? (
          <EmptyHint>Todavía no hay productos. Creá el primero.</EmptyHint>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                meta={`$${Number(p.price).toLocaleString('es-AR')}`}
                actions={
                  <StatusPill tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status}</StatusPill>
                }
              />
            ))}
          </div>
        )}
      </PanelCard>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-product-title"
        >
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <h2 id="new-product-title" className="text-lg font-extrabold">
              Nuevo producto
            </h2>
            {(['name', 'description', 'price', 'compareAtPrice', 'stockQuantity', 'photoUrl'] as const).map(
              (k) => (
                <div key={k} className="space-y-2">
                  <Label htmlFor={k}>{FIELD_LABELS[k]}</Label>
                  <Input
                    id={k}
                    className="min-h-11"
                    placeholder={FIELD_LABELS[k]}
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    required={k === 'name' || k === 'price'}
                  />
                </div>
              ),
            )}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="min-h-11 flex-1 font-bold" disabled={create.isPending}>
                {create.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </PageShell>
  );
}
