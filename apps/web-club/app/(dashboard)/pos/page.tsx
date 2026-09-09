'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import {
  createPosSale,
  listPosDaySales,
  listShopProductsAdmin,
  type PosDaySales,
  type ShopProduct,
} from '@/lib/shop-api';
import { formatCurrency } from '@/lib/currency';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CartLine = { product: ShopProduct; quantity: number };

function productPrice(p: ShopProduct) {
  return Number(p.price) || 0;
}

function productStock(p: ShopProduct) {
  return p.stockQuantity ?? p.stock_quantity ?? null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PosPage() {
  const { activeClubId, activeClub } = useClub();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MP' | 'MANUAL'>('CASH');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(todayISO());

  const productsQuery = useQuery({
    queryKey: ['club-shop-products-admin', activeClubId],
    queryFn: () => listShopProductsAdmin(activeClubId!),
    enabled: !!activeClubId,
  });

  const dayQuery = useQuery({
    queryKey: ['pos-day', activeClubId, day],
    queryFn: () => listPosDaySales(activeClubId!, day),
    enabled: !!activeClubId,
  });

  const activeProducts = useMemo(
    () => (productsQuery.data || []).filter((p) => p.active !== false && p.isActive !== false),
    [productsQuery.data],
  );

  const cartTotal = cart.reduce((sum, line) => sum + productPrice(line.product) * line.quantity, 0);

  function addToCart(product: ShopProduct) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      const stock = productStock(product);
      if (existing) {
        const nextQty = existing.quantity + 1;
        if (stock != null && nextQty > stock) {
          toast.error('Sin stock suficiente');
          return prev;
        }
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: nextQty } : l,
        );
      }
      if (stock != null && stock < 1) {
        toast.error('Sin stock');
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          const stock = productStock(l.product);
          const next = l.quantity + delta;
          if (stock != null && next > stock) return l;
          return { ...l, quantity: next };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!activeClubId || !cart.length) throw new Error('Carrito vacío');
      return createPosSale(activeClubId, {
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod,
        note: note.trim() || undefined,
      });
    },
    onSuccess: async (data) => {
      setCart([]);
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pos-day', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-products-admin', activeClubId] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-sales', activeClubId] }),
      ]);
      toast.success(`Venta registrada · ${formatCurrency(data.total)}`);
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || 'No se pudo cobrar');
    },
  });

  if (!activeClubId) {
    return (
      <div className="space-y-6">
        <PageHeader title="POS" subtitle="Caja de mostrador" />
        <EmptyState title="Elegí un club" description="Seleccioná un club activo." />
      </div>
    );
  }

  const dayData = dayQuery.data as PosDaySales | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS mostrador"
        subtitle={`${activeClub?.name || 'Club'} · venta rápida en recepción`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Productos</CardTitle>
          </CardHeader>
          <CardContent>
            {productsQuery.isLoading ? <DashboardSkeleton /> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {activeProducts.map((p) => {
                const stock = productStock(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="rounded-xl border bg-card p-3 text-left transition hover:border-primary"
                  >
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(productPrice(p))}
                      {stock != null ? ` · stock ${stock}` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
            {!activeProducts.length && !productsQuery.isLoading ? (
              <EmptyState
                title="Sin productos"
                description="Cargá el catálogo en Tienda antes de vender en mostrador."
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="size-4" /> Carrito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.map((line) => (
              <div key={line.product.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(productPrice(line.product))} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 rounded-lg"
                    onClick={() => updateQty(line.product.id, -1)}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 rounded-lg"
                    onClick={() => updateQty(line.product.id, 1)}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
            {!cart.length ? (
              <p className="text-sm text-muted-foreground">Tocá productos para armar la venta.</p>
            ) : null}

            <div className="space-y-2 border-t pt-3">
              <Label>Medio de pago</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['CASH', 'Efectivo'],
                    ['MP', 'Mercado Pago'],
                    ['MANUAL', 'Otro'],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={paymentMethod === value ? 'default' : 'outline'}
                    className="rounded-xl"
                    onClick={() => setPaymentMethod(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nota (opcional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Cliente walk-in, mesa, etc."
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-extrabold">{formatCurrency(cartTotal)}</span>
            </div>

            <Button
              className="w-full rounded-xl"
              disabled={!cart.length || saleMutation.isPending}
              onClick={() => saleMutation.mutate()}
            >
              Cobrar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Ventas del día</CardTitle>
          <Input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-44 rounded-xl"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {dayData ? (
            <div className="flex flex-wrap gap-2">
              <Badge>Total {formatCurrency(dayData.total)}</Badge>
              {Object.entries(dayData.byMethod || {}).map(([method, amount]) => (
                <Badge key={method} variant="secondary">
                  {method}: {formatCurrency(amount)}
                </Badge>
              ))}
            </div>
          ) : null}
          {(dayData?.sales || []).map((sale) => (
            <div
              key={sale.id}
              className="flex flex-col gap-1 rounded-xl border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {sale.product_name} × {sale.quantity}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sale.user_name}
                  {sale.sold_by_name ? ` · cobró ${sale.sold_by_name}` : ''}
                  {sale.payment_method ? ` · ${sale.payment_method}` : ''}
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(Number(sale.subtotal))}</p>
            </div>
          ))}
          {dayQuery.isLoading ? <DashboardSkeleton /> : null}
          {!dayQuery.isLoading && !dayData?.sales?.length ? (
            <p className="text-sm text-muted-foreground">Sin ventas POS en esta fecha.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
