'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageShell, StatusPill } from '@/components/layout/PageShell';
import { DataTable, type DataTableColumn } from '@/components/layout/DataTable';

type Product = {
  id: string;
  name: string;
  price: number | string;
  status: string;
  stock_quantity?: number;
  photo_url?: string;
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT'>('ALL');
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

  const products = useMemo(() => {
    const all = (listQ.data || []) as Product[];
    if (statusFilter === 'ALL') return all;
    return all.filter((p) => p.status === statusFilter);
  }, [listQ.data, statusFilter]);

  const columns: DataTableColumn<Product>[] = [
    {
      key: 'name',
      header: 'Producto',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="size-10 overflow-hidden rounded-lg bg-muted">
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <span className="font-semibold">{p.name}</span>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      cell: (p) => `$${Number(p.price).toLocaleString('es-AR')}`,
    },
    {
      key: 'stock',
      header: 'Stock',
      cell: (p) => (p.stock_quantity != null ? p.stock_quantity : '—'),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (p) => (
        <StatusPill tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status}</StatusPill>
      ),
    },
  ];

  return (
    <PageShell
      kicker="Catálogo"
      title="Productos"
      description="Publicá y gestioná el inventario de tu tienda."
      variant="table"
      actions={
        <Button type="button" className="min-h-11 gap-2 font-bold" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nuevo
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(['ALL', 'ACTIVE', 'DRAFT'] as const).map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            className="min-h-9"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'ALL' ? 'Todos' : s}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={products}
        loading={listQ.isLoading}
        empty="Todavía no hay productos. Creá el primero."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nuevo producto</DialogTitle>
            </DialogHeader>
            {form.photoUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.photoUrl} alt="" className="size-full object-cover" />
              </div>
            ) : null}
            {(['name', 'description', 'price', 'compareAtPrice', 'stockQuantity', 'photoUrl'] as const).map(
              (k) => (
                <div key={k} className="space-y-2">
                  <Label htmlFor={k}>{FIELD_LABELS[k]}</Label>
                  <Input
                    id={k}
                    className="min-h-11"
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    required={k === 'name' || k === 'price'}
                  />
                </div>
              ),
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11 font-bold" disabled={create.isPending}>
                {create.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
