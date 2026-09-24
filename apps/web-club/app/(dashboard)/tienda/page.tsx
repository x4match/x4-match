'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImagePlus, Package, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import {
  listShopSales,
  SHOP_CATEGORIES,
  SHOP_CATEGORY_LABELS,
  shopStatusLabel,
  uploadShopProductPhoto,
  type ShopCoupon,
  type ShopProduct,
  type ShopSaleRow,
  type ShopStats,
} from '@/lib/shop-api';
import { formatCurrency } from '@/lib/currency';
import { formatFullDate } from '@/lib/format';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ManageProduct = ShopProduct;

function productPhoto(p: ManageProduct) {
  return p.photoUrl || p.photo_url || null;
}

function productStock(p: ManageProduct) {
  return p.stockQuantity ?? p.stock_quantity ?? null;
}

function isMatchExtra(p: ManageProduct) {
  return !!(p.isMatchExtra || p.available_as_match_extra);
}

function ShopInner() {
  const params = useSearchParams();
  const { activeClubId, activeClub } = useClub();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(params.get('tab') || 'stats');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const t = params.get('tab');
    if (t) setTab(t);
  }, [params]);

  useEffect(() => {
    return () => {
      if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    };
  }, [pendingPhotoPreview]);

  const statsQuery = useQuery({
    queryKey: ['club-shop-stats', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/shop/stats`, { params: { days: 30 } });
      return res.data as ShopStats;
    },
    enabled: !!activeClubId,
  });

  const productsQuery = useQuery({
    queryKey: ['club-shop-manage', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/shop/products/manage`);
      return res.data as ManageProduct[];
    },
    enabled: !!activeClubId,
  });

  const couponsQuery = useQuery({
    queryKey: ['club-shop-coupons', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/shop/coupons`);
      return res.data as ShopCoupon[];
    },
    enabled: !!activeClubId,
  });

  const salesQuery = useQuery({
    queryKey: ['club-shop-sales', activeClubId],
    queryFn: () => listShopSales(activeClubId!),
    enabled: !!activeClubId,
  });

  const redemptionsQuery = useQuery({
    queryKey: ['club-rewards-redemptions', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rewards/redemptions`);
      return res.data as Array<{
        id: string;
        userName?: string;
        user_name?: string;
        rewardTitle?: string;
        reward_title?: string;
        createdAt?: string;
        created_at?: string;
        pointsSpent?: number;
        points_spent?: number;
        status?: string;
        redemptionCode?: string;
        redemption_code?: string;
      }>;
    },
    enabled: !!activeClubId && (tab === 'redemptions' || tab === 'rewards'),
  });

  const rewardsQuery = useQuery({
    queryKey: ['club-rewards-manage', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rewards`);
      return res.data as Array<{
        id: string;
        title: string;
        description?: string | null;
        pointsRequired?: number;
        points_required?: number;
        rewardType?: string;
        reward_type?: string;
        active?: boolean;
        stock?: number | null;
        maxPerUser?: number | null;
        max_per_user?: number | null;
      }>;
    },
    enabled: !!activeClubId && tab === 'rewards',
  });

  const [productOpen, setProductOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [matchExtra, setMatchExtra] = useState(false);
  const [saleDetail, setSaleDetail] = useState<ShopSaleRow | null>(null);
  const [stockDialogId, setStockDialogId] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState('');

  const [couponCode, setCouponCode] = useState('');
  const [couponLabel, setCouponLabel] = useState('');
  const [couponPercent, setCouponPercent] = useState('');
  const [couponPoints, setCouponPoints] = useState('');

  const [rewardOpen, setRewardOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardPoints, setRewardPoints] = useState('50');
  const [rewardType, setRewardType] = useState('BENEFIT');
  const [rewardStock, setRewardStock] = useState('');
  const [rewardMaxPerUser, setRewardMaxPerUser] = useState('');
  const [rewardActive, setRewardActive] = useState(true);

  const clearPendingPhoto = () => {
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
  };

  const openNew = (asExtra = false) => {
    setEditingId(null);
    setName('');
    setDesc('');
    setPrice('');
    setStock('');
    setCategory('OTHER');
    setMatchExtra(asExtra);
    clearPendingPhoto();
    setProductOpen(true);
  };

  const openEdit = (p: ManageProduct) => {
    setEditingId(p.id);
    setName(p.name);
    setDesc(p.description || '');
    setPrice(String(p.price));
    setStock(productStock(p) != null ? String(productStock(p)) : '');
    setCategory(p.category || 'OTHER');
    setMatchExtra(isMatchExtra(p));
    clearPendingPhoto();
    setProductOpen(true);
  };

  const invalidateShop = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] }),
      queryClient.invalidateQueries({ queryKey: ['club-shop-stats', activeClubId] }),
      queryClient.invalidateQueries({ queryKey: ['club-shop-sales', activeClubId] }),
    ]);
  };

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: desc.trim() || undefined,
        price: parseFloat(price) || 0,
        category,
        stockQuantity: stock.trim() ? parseInt(stock, 10) : undefined,
        availableAsMatchExtra: matchExtra,
      };
      let productId = editingId;
      if (editingId) {
        await api.patch(`/clubs/${activeClubId}/shop/products/${editingId}`, {
          ...payload,
          description: desc.trim(),
          active: true,
        });
      } else {
        const res = await api.post(`/clubs/${activeClubId}/shop/products`, payload);
        productId = res.data?.id as string;
      }
      if (productId && pendingPhoto) {
        await uploadShopProductPhoto(activeClubId!, productId, pendingPhoto);
      }
      return productId;
    },
    onSuccess: async () => {
      setProductOpen(false);
      clearPendingPhoto();
      await invalidateShop();
      toast.success(editingId ? 'Producto actualizado' : 'Producto publicado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo guardar');
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      return uploadShopProductPhoto(activeClubId!, productId, file);
    },
    onSuccess: async () => {
      await invalidateShop();
      toast.success('Foto actualizada');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo subir la foto');
    },
    onSettled: () => setPhotoTargetId(null),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clubs/${activeClubId}/shop/products/${id}`);
    },
    onSuccess: async () => {
      await invalidateShop();
      toast.success('Producto eliminado');
    },
  });

  const updateStock = useMutation({
    mutationFn: async ({ id, stockQuantity }: { id: string; stockQuantity: number }) => {
      await api.patch(`/clubs/${activeClubId}/shop/products/${id}/stock`, { stockQuantity });
    },
    onSuccess: async () => {
      setStockDialogId(null);
      await invalidateShop();
      toast.success('Stock actualizado');
    },
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const points = couponPoints.trim() ? Number(couponPoints) : undefined;
      const percent = couponPercent.trim() ? Number(couponPercent) : undefined;
      if (!couponCode.trim()) throw new Error('Indicá un código');
      if (!percent && !points) throw new Error('Indicá descuento % o puntos canjeables');
      await api.post(`/clubs/${activeClubId}/shop/coupons`, {
        code: couponCode.trim().toUpperCase(),
        label: couponLabel.trim() || couponCode.trim().toUpperCase(),
        discountPercent: percent || undefined,
        pointsCost: points || undefined,
      });
    },
    onSuccess: async () => {
      setCouponCode('');
      setCouponLabel('');
      setCouponPercent('');
      setCouponPoints('');
      await queryClient.invalidateQueries({ queryKey: ['club-shop-coupons', activeClubId] });
      toast.success('Cupón creado');
    },
    onError: (err: { message?: string; response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || err.message || 'Error al crear cupón');
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clubs/${activeClubId}/shop/coupons/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-shop-coupons', activeClubId] });
      toast.success('Cupón eliminado');
    },
  });

  const openNewReward = () => {
    setEditingRewardId(null);
    setRewardTitle('');
    setRewardDesc('');
    setRewardPoints('50');
    setRewardType('BENEFIT');
    setRewardStock('');
    setRewardMaxPerUser('');
    setRewardActive(true);
    setRewardOpen(true);
  };

  const openEditReward = (reward: {
    id: string;
    title: string;
    description?: string | null;
    pointsRequired?: number;
    points_required?: number;
    rewardType?: string;
    reward_type?: string;
    active?: boolean;
    stock?: number | null;
    maxPerUser?: number | null;
    max_per_user?: number | null;
  }) => {
    setEditingRewardId(reward.id);
    setRewardTitle(reward.title);
    setRewardDesc(reward.description || '');
    setRewardPoints(String(reward.pointsRequired ?? reward.points_required ?? 50));
    setRewardType(String(reward.rewardType ?? reward.reward_type ?? 'BENEFIT'));
    setRewardStock(reward.stock != null ? String(reward.stock) : '');
    setRewardMaxPerUser(
      (reward.maxPerUser ?? reward.max_per_user) != null
        ? String(reward.maxPerUser ?? reward.max_per_user)
        : '',
    );
    setRewardActive(reward.active !== false);
    setRewardOpen(true);
  };

  const saveReward = useMutation({
    mutationFn: async () => {
      const payload = {
        title: rewardTitle.trim(),
        description: rewardDesc.trim() || undefined,
        pointsRequired: parseInt(rewardPoints, 10) || 50,
        rewardType: rewardType,
        stock: rewardStock.trim() ? parseInt(rewardStock, 10) : null,
        maxPerUser: rewardMaxPerUser.trim() ? parseInt(rewardMaxPerUser, 10) : null,
        active: rewardActive,
      };
      if (editingRewardId) {
        await api.patch(`/clubs/${activeClubId}/rewards/${editingRewardId}`, payload);
      } else {
        await api.post(`/clubs/${activeClubId}/rewards`, payload);
      }
    },
    onSuccess: async () => {
      setRewardOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['club-rewards-manage', activeClubId] });
      toast.success(editingRewardId ? 'Premio actualizado' : 'Premio publicado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo guardar el premio');
    },
  });

  const deactivateReward = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/clubs/${activeClubId}/rewards/${id}`, { active: false });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-rewards-manage', activeClubId] });
      toast.success('Premio desactivado');
    },
  });

  const fulfillRedemption = useMutation({
    mutationFn: async (redemptionId: string) => {
      await api.post(`/clubs/${activeClubId}/redemptions/${redemptionId}/fulfill`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-rewards-redemptions', activeClubId] });
      toast.success('Premio entregado');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo entregar');
    },
  });

  const cancelRedemption = useMutation({
    mutationFn: async (redemptionId: string) => {
      await api.post(`/clubs/${activeClubId}/redemptions/${redemptionId}/cancel`, {
        reason: 'Cancelado por el club',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-rewards-redemptions', activeClubId] });
      toast.success('Canje cancelado y puntos reintegrados');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'No se pudo cancelar');
    },
  });

  if (!activeClubId) return <EmptyState title="Seleccioná un club" />;
  if (productsQuery.isLoading && statsQuery.isLoading) return <DashboardSkeleton />;

  const products = productsQuery.data || [];
  const matchExtras = products.filter(isMatchExtra);
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tienda"
        subtitle={activeClub?.name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => openNew(true)}>
              <Plus className="size-4" />
              Nuevo extra
            </Button>
            <Button className="rounded-xl" onClick={() => openNew(false)}>
              <Plus className="size-4" />
              Nuevo producto
            </Button>
          </div>
        }
      />

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (photoTargetId) {
            uploadPhotoMutation.mutate({ productId: photoTargetId, file });
            return;
          }
          if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
          setPendingPhoto(file);
          setPendingPhotoPreview(URL.createObjectURL(file));
        }}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-surface-0 p-1">
          <TabsTrigger value="stats" className="rounded-lg">
            Estadísticas
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-lg">
            Productos
          </TabsTrigger>
          <TabsTrigger value="matchExtras" className="rounded-lg">
            Extras
          </TabsTrigger>
          <TabsTrigger value="coupons" className="rounded-lg">
            Cupones
          </TabsTrigger>
          <TabsTrigger value="sales" className="rounded-lg">
            Ventas
          </TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-lg">
            Premios
          </TabsTrigger>
          <TabsTrigger value="redemptions" className="rounded-lg">
            Canjes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4 space-y-4">
          {!stats ? (
            <EmptyState title="Sin estadísticas" description="Todavía no hay ventas confirmadas." />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Período" value={`${stats.periodDays} días`} />
                <StatCard label="Ingresos" value={formatCurrency(stats.totalRevenue)} highlight />
                <StatCard label="Ventas" value={String(stats.totalSales)} />
                <StatCard label="Stock bajo" value={String(stats.lowStockCount ?? 0)} />
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Producto top</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.topProduct ? (
                      <>
                        <p className="font-semibold">{stats.topProduct.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {stats.topProduct.salesCount} ventas ·{' '}
                          {formatCurrency(stats.topProduct.revenue)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin datos aún</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Última venta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.lastSale ? (
                      <>
                        <p className="font-semibold">
                          {stats.lastSale.productName} × {stats.lastSale.quantity}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatCurrency(stats.lastSale.subtotal)} ·{' '}
                          {formatFullDate(stats.lastSale.createdAt)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin ventas</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Extras de partido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatCurrency(stats.extrasSold?.revenue ?? 0)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stats.extrasSold?.salesCount ?? 0} ventas
                    </p>
                  </CardContent>
                </Card>
              </div>

              {stats.byCategory?.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Por categoría</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {stats.byCategory.map((row) => (
                      <div
                        key={row.category}
                        className="flex items-center justify-between rounded-xl bg-surface-0/70 px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">
                            {SHOP_CATEGORY_LABELS[row.category] || row.category}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.salesCount} ventas</p>
                        </div>
                        <p className="font-semibold tabular-nums text-primary">
                          {formatCurrency(row.revenue)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-4 space-y-3">
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onEdit={() => openEdit(p)}
              onDelete={() => deleteProduct.mutate(p.id)}
              onStock={() => {
                setStockDialogId(p.id);
                setStockValue(String(productStock(p) ?? 0));
              }}
              onPhoto={() => {
                setPhotoTargetId(p.id);
                photoInputRef.current?.click();
              }}
            />
          ))}
          {!products.length ? (
            <EmptyState
              title="Sin productos"
              description="Publicá el primero con foto y stock."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="matchExtras" className="mt-4 space-y-3">
          {matchExtras.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              extraBadge
              onEdit={() => openEdit(p)}
              onDelete={() => deleteProduct.mutate(p.id)}
              onStock={() => {
                setStockDialogId(p.id);
                setStockValue(String(productStock(p) ?? 0));
              }}
              onPhoto={() => {
                setPhotoTargetId(p.id);
                photoInputRef.current?.click();
              }}
            />
          ))}
          {!matchExtras.length ? (
            <EmptyState
              title="Sin extras de partido"
              description="Creá un extra o marcá un producto como disponible en partidos."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="coupons" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nuevo cupón</CardTitle>
              <p className="text-sm text-muted-foreground">
                Descuento en tienda y/o puntos canjeables de regalo (no suman al ranking competitivo).
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                placeholder="Código"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="rounded-xl"
              />
              <Input
                placeholder="Nombre (ej. 100 pts de regalo)"
                value={couponLabel}
                onChange={(e) => setCouponLabel(e.target.value)}
                className="rounded-xl"
              />
              <Input
                placeholder="% descuento (opcional)"
                value={couponPercent}
                onChange={(e) => setCouponPercent(e.target.value)}
                className="rounded-xl"
              />
              <Input
                placeholder="Pts canjeables (opcional)"
                value={couponPoints}
                onChange={(e) => setCouponPoints(e.target.value)}
                className="rounded-xl"
              />
              <Button className="rounded-xl" onClick={() => createCoupon.mutate()}>
                Crear cupón
              </Button>
            </CardContent>
          </Card>
          {(couponsQuery.data || []).map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{c.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.label ? `${c.label} · ` : ''}
                    {(c.discountPercent ?? c.discount_percent) != null
                      ? `${c.discountPercent ?? c.discount_percent}%`
                      : null}
                    {(c.pointsCost ?? c.points_cost)
                      ? `${(c.discountPercent ?? c.discount_percent) != null ? ' · ' : ''}+${c.pointsCost ?? c.points_cost} pts canjeables`
                      : (c.discountPercent ?? c.discount_percent) == null
                        ? formatCurrency(c.discountAmount ?? c.discount_amount ?? 0)
                        : ''}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => deleteCoupon.mutate(c.id)}
                >
                  Eliminar
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sales" className="mt-4 space-y-2">
          {(salesQuery.data || []).map((sale) => (
            <Card
              key={sale.id}
              className="cursor-pointer transition-colors hover:bg-surface-0/40"
              onClick={() => setSaleDetail(sale)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">
                    {sale.product_name} × {sale.quantity}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sale.user_name} · {formatFullDate(sale.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{formatCurrency(sale.subtotal)}</p>
                  <Badge variant="secondary">{shopStatusLabel(sale.status)}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {!salesQuery.data?.length ? <EmptyState title="Sin ventas" /> : null}
        </TabsContent>

        <TabsContent value="rewards" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button className="rounded-xl" onClick={openNewReward}>
              <Plus className="size-4" />
              Nuevo premio
            </Button>
          </div>
          {(rewardsQuery.data || []).map((reward) => {
            const pts = reward.pointsRequired ?? reward.points_required ?? 0;
            return (
              <Card key={reward.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{reward.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {pts} pts
                      {reward.stock != null ? ` · stock ${reward.stock}` : ' · stock ilimitado'}
                      {(reward.maxPerUser ?? reward.max_per_user) != null
                        ? ` · máx ${reward.maxPerUser ?? reward.max_per_user}/jugador`
                        : ''}
                      {reward.active === false ? ' · inactivo' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openEditReward(reward)}>
                      Editar
                    </Button>
                    {reward.active !== false ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => deactivateReward.mutate(reward.id)}
                      >
                        Desactivar
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!rewardsQuery.data?.length ? (
            <EmptyState title="Sin premios" description="Creá beneficios canjeables por puntos." />
          ) : null}
        </TabsContent>

        <TabsContent value="redemptions" className="mt-4 space-y-2">
          {(redemptionsQuery.data || []).map((r) => {
            const title = r.rewardTitle || r.reward_title || 'Recompensa';
            const user = r.userName || r.user_name || 'Jugador';
            const created = r.createdAt || r.created_at;
            const spent = r.pointsSpent ?? r.points_spent;
            const code = r.redemptionCode || r.redemption_code;
            const pending = r.status === 'PENDING' || !r.status;
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-muted-foreground">
                      {user}
                      {created ? ` · ${formatFullDate(created)}` : ''}
                      {spent != null ? ` · ${spent} pts` : ''}
                      {r.status ? ` · ${r.status}` : ''}
                    </p>
                    {code ? (
                      <p className="mt-1 font-mono text-lg font-bold tracking-wider text-primary">{code}</p>
                    ) : null}
                  </div>
                  {pending ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-lg"
                        onClick={() => fulfillRedemption.mutate(r.id)}
                        disabled={fulfillRedemption.isPending}
                      >
                        Entregar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => cancelRedemption.mutate(r.id)}
                        disabled={cancelRedemption.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
          {!redemptionsQuery.data?.length ? <EmptyState title="Sin canjes" /> : null}
        </TabsContent>
      </Tabs>

      <Dialog
        open={productOpen}
        onOpenChange={(open) => {
          setProductOpen(open);
          if (!open) clearPendingPhoto();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? 'Editar producto'
                : matchExtra
                  ? 'Nuevo extra de partido'
                  : 'Nuevo producto'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-surface-0">
                {(() => {
                  const existing =
                    editingId
                      ? productPhoto(products.find((p) => p.id === editingId) || ({} as ManageProduct))
                      : null;
                  const src = pendingPhotoPreview || existing;
                  if (!src) {
                    return <Package className="size-7 text-muted-foreground" />;
                  }
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="size-full object-cover" />
                  );
                })()}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setPhotoTargetId(null);
                  photoInputRef.current?.click();
                }}
              >
                <ImagePlus className="size-4" />
                {pendingPhoto ||
                  (editingId &&
                    productPhoto(products.find((p) => p.id === editingId) || ({} as ManageProduct)))
                  ? 'Cambiar foto'
                  : 'Agregar foto'}
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Precio</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Stock</Label>
                <Input value={stock} onChange={(e) => setStock(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHOP_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SHOP_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={matchExtra} onCheckedChange={setMatchExtra} />
              <Label>Disponible como extra de partido</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="rounded-xl"
              onClick={() => saveProduct.mutate()}
              disabled={!name.trim() || saveProduct.isPending}
            >
              {saveProduct.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!saleDetail} onOpenChange={(open) => !open && setSaleDetail(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de venta</DialogTitle>
          </DialogHeader>
          {saleDetail ? (
            <div className="space-y-3 text-sm">
              <DetailRow label="Producto" value={saleDetail.product_name} />
              <DetailRow label="Cantidad" value={String(saleDetail.quantity)} />
              <DetailRow label="Subtotal" value={formatCurrency(saleDetail.subtotal)} />
              <DetailRow label="Cliente" value={saleDetail.user_name} />
              <DetailRow label="Fecha" value={formatFullDate(saleDetail.created_at)} />
              <DetailRow label="Estado" value={shopStatusLabel(saleDetail.status)} />
              <DetailRow
                label="Partido"
                value={saleDetail.match_title || 'Venta de mostrador'}
              />
              {saleDetail.unit_price != null ? (
                <DetailRow label="Precio unitario" value={formatCurrency(saleDetail.unit_price)} />
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setSaleDetail(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockDialogId} onOpenChange={(open) => !open && setStockDialogId(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Actualizar stock</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            value={stockValue}
            onChange={(e) => setStockValue(e.target.value)}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button
              className="rounded-xl"
              onClick={() => {
                if (!stockDialogId) return;
                const next = Number(stockValue);
                if (!Number.isFinite(next) || next < 0) {
                  toast.error('Stock inválido');
                  return;
                }
                updateStock.mutate({ id: stockDialogId, stockQuantity: next });
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRewardId ? 'Editar premio' : 'Nuevo premio'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={rewardTitle}
                onChange={(e) => setRewardTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input
                value={rewardDesc}
                onChange={(e) => setRewardDesc(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Puntos</Label>
                <Input
                  type="number"
                  value={rewardPoints}
                  onChange={(e) => setRewardPoints(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={rewardType} onValueChange={setRewardType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BENEFIT">Beneficio</SelectItem>
                    <SelectItem value="DISCOUNT">Descuento</SelectItem>
                    <SelectItem value="FREE_SLOT">Turno gratis</SelectItem>
                    <SelectItem value="MERCH">Merch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Stock (vacío = ilimitado)</Label>
                <Input
                  type="number"
                  value={rewardStock}
                  onChange={(e) => setRewardStock(e.target.value)}
                  className="rounded-xl"
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-1">
                <Label>Máx. por jugador</Label>
                <Input
                  type="number"
                  value={rewardMaxPerUser}
                  onChange={(e) => setRewardMaxPerUser(e.target.value)}
                  className="rounded-xl"
                  placeholder="Sin tope"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <Label>Activo</Label>
              <Switch checked={rewardActive} onCheckedChange={setRewardActive} />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="rounded-xl"
              disabled={!rewardTitle.trim() || saveReward.isPending}
              onClick={() => saveReward.mutate()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-2 text-2xl font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-surface-0/60 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ProductRow({
  product,
  extraBadge,
  onEdit,
  onDelete,
  onStock,
  onPhoto,
}: {
  product: ManageProduct;
  extraBadge?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStock: () => void;
  onPhoto: () => void;
}) {
  const photo = productPhoto(product);
  const stock = productStock(product);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-0">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <Package className="size-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{product.name}</p>
              {extraBadge || isMatchExtra(product) ? (
                <Badge variant="secondary">Extra</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(product.price)} · stock {stock ?? '—'}
              {product.category
                ? ` · ${SHOP_CATEGORY_LABELS[product.category] || product.category}`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onPhoto}>
            <ImagePlus className="size-3.5" />
            Foto
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onStock}>
            Stock
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onEdit}>
            Editar
          </Button>
          <Button size="sm" variant="destructive" className="rounded-xl" onClick={onDelete}>
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TiendaPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ShopInner />
    </Suspense>
  );
}
