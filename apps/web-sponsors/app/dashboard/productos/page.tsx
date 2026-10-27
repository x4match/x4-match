'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageShell, StatusPill } from '@/components/layout/PageShell';
import { DataTable, type DataTableColumn } from '@/components/layout/DataTable';
import { ImageField } from '@/components/dashboard/ImageField';
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog';

type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  compare_at_price?: number | string | null;
  status: ProductStatus;
  stock_quantity?: number | null;
  photo_url?: string | null;
  external_source?: string | null;
};

type FormState = {
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  photoUrl: string;
  status: ProductStatus;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  price: '',
  compareAtPrice: '',
  stockQuantity: '',
  photoUrl: '',
  status: 'ACTIVE',
};

const STATUS_FILTER_LABELS = {
  ALL: 'Todos',
  ACTIVE: 'Publicados',
  DRAFT: 'Borradores',
} as const;

const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: 'Publicado',
  DRAFT: 'Borrador',
  ARCHIVED: 'Archivado',
};

function apiErrorMessage(err: unknown): string | undefined {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(msg) ? msg[0] : msg;
}

function toForm(p: Product): FormState {
  return {
    name: p.name ?? '',
    description: p.description ?? '',
    price: p.price != null ? String(Number(p.price)) : '',
    compareAtPrice: p.compare_at_price != null ? String(Number(p.compare_at_price)) : '',
    stockQuantity: p.stock_quantity != null ? String(p.stock_quantity) : '',
    photoUrl: p.photo_url ?? '',
    status: p.status ?? 'ACTIVE',
  };
}

export default function ProductosPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['partner-products', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}/products`)).data,
    enabled: !!activeSponsorId,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT'>('ALL');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm(toForm(p));
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description,
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : undefined,
        photoUrl: form.photoUrl || undefined,
        status: form.status,
      };
      return editing
        ? api.patch(`/sponsors/me/${activeSponsorId}/products/${editing.id}`, body)
        : api.post(`/sponsors/me/${activeSponsorId}/products`, body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Producto actualizado' : 'Producto creado');
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ['partner-products', activeSponsorId] });
    },
    onError: (err) => {
      toast.error(
        apiErrorMessage(err) ||
          (editing ? 'No se pudo actualizar el producto' : 'No se pudo crear el producto'),
      );
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const [toDelete, setToDelete] = useState<Product | null>(null);
  const remove = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/sponsors/me/${activeSponsorId}/products/${id}`)).data as {
        archived?: boolean;
      },
    onSuccess: (data, id) => {
      toast.success(
        data?.archived
          ? 'El producto tiene pedidos: lo archivamos y ya no se muestra en tu tienda'
          : 'Producto eliminado',
      );
      setToDelete(null);
      if (editing?.id === id) {
        setOpen(false);
        setEditing(null);
        setForm(EMPTY_FORM);
      }
      qc.invalidateQueries({ queryKey: ['partner-products', activeSponsorId] });
      qc.invalidateQueries({ queryKey: ['partner-cats', activeSponsorId] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err) || 'No se pudo eliminar el producto');
    },
  });

  const [confirmAll, setConfirmAll] = useState(false);
  const removeAll = useMutation({
    mutationFn: async () =>
      (await api.delete(`/sponsors/me/${activeSponsorId}/products`)).data as {
        deleted: number;
        archived: number;
      },
    onSuccess: (data) => {
      toast.success(
        data.archived > 0
          ? `${data.deleted} eliminados. ${data.archived} tenían pedidos y quedaron archivados.`
          : `${data.deleted} productos eliminados`,
      );
      setConfirmAll(false);
      qc.invalidateQueries({ queryKey: ['partner-products', activeSponsorId] });
      qc.invalidateQueries({ queryKey: ['partner-cats', activeSponsorId] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err) || 'No se pudieron eliminar los productos');
    },
  });
  const removableCount = ((listQ.data || []) as Product[]).filter((p) => p.status !== 'ARCHIVED').length;
  const hasSynced = ((listQ.data || []) as Product[]).some((p) => p.external_source);

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
        <StatusPill tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-52 text-right',
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(p);
            }}
          >
            <Pencil className="size-3.5" aria-hidden />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-1.5"
            aria-label={`Eliminar ${p.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setToDelete(p);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <PageShell
      kicker="Catálogo"
      title="Productos"
      description="Publicá y gestioná el inventario de tu tienda."
      variant="table"
      actions={
        <div className="flex flex-wrap gap-2">
          {removableCount > 0 ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 gap-2 font-bold"
              onClick={() => setConfirmAll(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Eliminar todos
            </Button>
          ) : null}
          <Button type="button" className="min-h-11 gap-2 font-bold" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Nuevo
          </Button>
        </div>
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
            {STATUS_FILTER_LABELS[s]}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={products}
        loading={listQ.isLoading}
        onRowClick={openEdit}
        empty="Todavía no hay productos. Creá el primero."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            </DialogHeader>
            {editing?.external_source ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Este producto se sincroniza desde tu tienda externa. Los cambios pueden pisarse en la
                próxima sincronización.
              </p>
            ) : null}
            {form.photoUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.photoUrl} alt="" className="size-full object-cover" />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                className="min-h-11"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="any"
                  className="min-h-11"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compareAtPrice">Precio anterior</Label>
                <Input
                  id="compareAtPrice"
                  type="number"
                  min={0}
                  step="any"
                  className="min-h-11"
                  value={form.compareAtPrice}
                  onChange={(e) => set('compareAtPrice', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stockQuantity">Stock</Label>
                <Input
                  id="stockQuantity"
                  type="number"
                  min={0}
                  step={1}
                  className="min-h-11"
                  value={form.stockQuantity}
                  onChange={(e) => set('stockQuantity', e.target.value)}
                />
              </div>
            </div>
            <ImageField
              id="photoUrl"
              label="Foto"
              kind="product"
              sponsorId={activeSponsorId}
              value={form.photoUrl}
              onChange={(v) => set('photoUrl', v)}
              successMessage="Foto subida. Guardá el producto para aplicarla."
            />
            <div className="space-y-2">
              <Label>Estado</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[]).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={form.status === s ? 'default' : 'outline'}
                    onClick={() => set('status', s)}
                  >
                    {PRODUCT_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2">
              {editing ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 gap-1.5 sm:mr-auto"
                  onClick={() => setToDelete(editing)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Eliminar
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11 font-bold" disabled={save.isPending}>
                {save.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Eliminar "${toDelete?.name ?? ''}"?`}
        description={
          toDelete?.external_source
            ? 'Se quita de tu tienda. Si sigue en tu tienda externa, puede volver a aparecer en la próxima sincronización.'
            : 'Se quita de tu tienda. Si ya tiene pedidos, lo archivamos para conservar el historial.'
        }
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={removableCount === 1 ? '¿Eliminar el producto?' : `¿Eliminar los ${removableCount} productos?`}
        description={
          <>
            Se quitan todos de tu tienda y no se puede deshacer. Los que ya tienen pedidos se archivan
            para conservar el historial.
            {hasSynced
              ? ' Los que vienen de tu tienda externa pueden volver en la próxima sincronización.'
              : null}
          </>
        }
        confirmLabel="Eliminar todos"
        pending={removeAll.isPending}
        onConfirm={() => removeAll.mutate()}
      />
    </PageShell>
  );
}
