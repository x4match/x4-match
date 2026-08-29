import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, Alert, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { formatCurrency } from '@/lib/currency';
import { formatRelativeTime, formatShortDate } from '@/lib/format';
import { confirmShopPurchase, listShopSales, type ShopSaleRow } from '@/lib/shop-api';
import {
  pickAndUploadShopProductPhoto,
  pickShopProductPhoto,
  showShopProductPhotoOptions,
  uploadShopProductPhotoFromUri,
  type ShopProductPhotoSource,
} from '@/lib/shop-product-photo';
import { ui } from '@/theme/tokens';
import { tabScreenPadding } from '@/lib/layout';
import {
  Screen,
  AppHeader,
  AppCard,
  PrimaryButton,
  InputField,
  EmptyState,
  SectionHeader,
  SelectionChip,
} from '@/components/padely';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';
import { ManagerQuickActions } from '@/components/club/ManagerQuickActions';

type ShopTab = 'stats' | 'products' | 'sales' | 'matchExtras' | 'coupons' | 'rewards' | 'redemptions';

interface ShopProductRow {
  id: string;
  name: string;
  description?: string;
  price: number | string;
  kind: string;
  category: string;
  stock_quantity?: number | null;
  available_as_match_extra?: boolean;
  active: boolean;
  photo_url?: string | null;
}

interface ShopCouponRow {
  id: string;
  code: string;
  label: string;
  discount_percent?: number | null;
  discount_amount?: number | string | null;
  points_cost?: number | null;
  max_uses?: number | null;
  uses_count: number;
  active: boolean;
}

interface RewardRow {
  id: string;
  title: string;
  description?: string;
  points_required: number;
  reward_type: string;
  active: boolean;
}

interface RedemptionRow {
  id: string;
  points_spent: number;
  created_at: string;
  user_name: string;
  user_nickname?: string;
  reward_title: string;
}

interface ShopStats {
  periodDays: number;
  totalRevenue: number;
  totalSales: number;
  byCategory: Array<{
    category: string;
    revenue: number;
    salesCount: number;
  }>;
  topProduct?: {
    id: string;
    name: string;
    revenue: number;
    salesCount: number;
  } | null;
  lastSale?: {
    productName: string;
    subtotal: number;
    quantity: number;
    createdAt: string;
  } | null;
  lowStockCount?: number;
  extrasSold?: {
    revenue: number;
    salesCount: number;
  };
}

const SHOP_CATEGORY_LABELS: Record<string, string> = {
  BALLS: 'Pelotas',
  DRINKS: 'Bebidas',
  FOOD: 'Comida',
  RENTAL: 'Alquiler',
  MERCH: 'Merch',
  OTHER: 'Otros',
};

const SHOP_TABS: { key: ShopTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
  { key: 'products', label: 'Stock', icon: 'cube-outline' },
  { key: 'sales', label: 'Cobros', icon: 'cash-outline' },
  { key: 'matchExtras', label: 'Extras', icon: 'tennisball-outline' },
  { key: 'coupons', label: 'Cupones', icon: 'pricetag-outline' },
  { key: 'rewards', label: 'Premios', icon: 'trophy-outline' },
  { key: 'redemptions', label: 'Canjes', icon: 'gift-outline' },
];

function stockLabel(qty?: number | null) {
  if (qty == null) return 'Sin límite';
  if (qty <= 0) return 'Agotado';
  if (qty <= 3) return `${qty} (bajo)`;
  return `${qty} u.`;
}

function ShopTabBar({ active, onChange }: { active: ShopTab; onChange: (t: ShopTab) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SHOP_TABS.map((tab) => (
          <SelectionChip
            key={tab.key}
            label={tab.label}
            selected={active === tab.key}
            onPress={() => onChange(tab.key)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function MatchExtraCheckbox({
  selected,
  onPress,
  disabled,
}: {
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: selected ? ui.colors.primary : ui.colors.border,
          backgroundColor: selected ? ui.colors.primary : '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ShopScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = isClub(user?.role);
  const params = useLocalSearchParams<{ tab?: string }>();

  const validTabs: ShopTab[] = [
    'stats',
    'products',
    'sales',
    'matchExtras',
    'coupons',
    'rewards',
    'redemptions',
  ];
  const initialTab = validTabs.includes(params.tab as ShopTab) ? (params.tab as ShopTab) : 'stats';
  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

  useEffect(() => {
    if (validTabs.includes(params.tab as ShopTab)) {
      setTab(params.tab as ShopTab);
    }
  }, [params.tab]);

  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('3500');
  const [productStock, setProductStock] = useState('10');
  const [productMatchExtra, setProductMatchExtra] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const [pendingProductPhotoUri, setPendingProductPhotoUri] = useState<string | null>(null);
  const [confirmingSaleId, setConfirmingSaleId] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [couponLabel, setCouponLabel] = useState('');
  const [couponDiscount, setCouponDiscount] = useState('10');
  const [couponPoints, setCouponPoints] = useState('');
  const [showCouponForm, setShowCouponForm] = useState(false);

  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardPoints, setRewardPoints] = useState('50');
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);

  const { data: clubs } = useMineClubs(canManage && !!user?.id);

  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId, clubs),
    [selectedClubId, clubs],
  );

  const {
    data: shopStats,
    isLoading: loadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['club-shop-stats', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/shop/stats`, { params: { days: 30 } });
      return res.data as ShopStats;
    },
    enabled: canManage && !!activeClubId && tab === 'stats',
  });

  const { data: shopProducts, isLoading: loadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['club-shop-manage', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/shop/products/manage`);
      return res.data as ShopProductRow[];
    },
    enabled: canManage && !!activeClubId,
  });

  const { data: coupons, isLoading: loadingCoupons, refetch: refetchCoupons } = useQuery({
    queryKey: ['club-shop-coupons', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/shop/coupons`);
      return res.data as ShopCouponRow[];
    },
    enabled: canManage && !!activeClubId && tab === 'coupons',
  });

  const { data: rewards, isLoading: loadingRewards, refetch: refetchRewards } = useQuery({
    queryKey: ['club-rewards-catalog', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rewards`);
      return res.data as RewardRow[];
    },
    enabled: canManage && !!activeClubId && tab === 'rewards',
  });

  const { data: redemptions, isLoading: loadingRedemptions, refetch: refetchRedemptions } = useQuery({
    queryKey: ['club-shop-redemptions', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/rewards/redemptions`);
      return res.data as RedemptionRow[];
    },
    enabled: canManage && !!activeClubId && (tab === 'redemptions' || tab === 'rewards'),
  });

  const { data: shopSales, isLoading: loadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['club-shop-sales', activeClubId],
    queryFn: () => listShopSales(activeClubId!),
    enabled: canManage && !!activeClubId && (tab === 'sales' || tab === 'stats'),
  });

  const pendingSales = (shopSales || []).filter((s) => s.status === 'PENDING');
  const activeProducts = (shopProducts || []).filter((p) => p.active);
  const matchExtraProducts = activeProducts.filter((p) => p.available_as_match_extra);
  const lowStockCount = activeProducts.filter((p) => p.stock_quantity != null && p.stock_quantity <= 3).length;
  const activeCoupons = (coupons || []).filter((c) => c.active);

  const resetProductForm = () => {
    setProductName('');
    setProductDesc('');
    setProductPrice('3500');
    setProductStock('10');
    setProductMatchExtra(false);
    setEditingProductId(null);
    setPendingProductPhotoUri(null);
    setShowProductForm(false);
  };

  const openCreateProduct = () => {
    setEditingProductId(null);
    setProductName('');
    setProductDesc('');
    setProductPrice('3500');
    setProductStock('10');
    setProductMatchExtra(false);
    setPendingProductPhotoUri(null);
    setShowProductForm(true);
  };

  const openEditProduct = (product: ShopProductRow) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductDesc(product.description || '');
    setProductPrice(String(Number(product.price) || 0));
    setProductStock(product.stock_quantity != null ? String(product.stock_quantity) : '');
    setProductMatchExtra(!!product.available_as_match_extra);
    setPendingProductPhotoUri(null);
    setShowProductForm(true);
  };

  const pickPendingProductPhoto = () => {
    const currentPhoto = editingProductId
      ? shopProducts?.find((p) => p.id === editingProductId)?.photo_url
      : null;
    showShopProductPhotoOptions({
      hasPhoto: !!pendingProductPhotoUri || !!currentPhoto,
      onPick: async (source: ShopProductPhotoSource) => {
        if (editingProductId && activeClubId) {
          setUploadingPhotoId(editingProductId);
          const url = await pickAndUploadShopProductPhoto(activeClubId, editingProductId, source);
          setUploadingPhotoId(null);
          if (url) {
            queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] });
            queryClient.invalidateQueries({ queryKey: ['club-shop-all', activeClubId] });
            queryClient.invalidateQueries({ queryKey: ['club-shop-addon', activeClubId] });
          }
          return;
        }
        const uri = await pickShopProductPhoto(source);
        if (uri) setPendingProductPhotoUri(uri);
      },
    });
  };

  const saveShopProduct = useMutation({
    mutationFn: async () => {
      if (!activeClubId || !productName.trim()) throw new Error('Completá el nombre');
      const payload = {
        name: productName.trim(),
        description: productDesc.trim() || undefined,
        price: parseFloat(productPrice) || 0,
        category: 'OTHER',
        stockQuantity: productStock.trim() ? parseInt(productStock, 10) : undefined,
        availableAsMatchExtra: productMatchExtra,
      };
      if (editingProductId) {
        const res = await api.patch(`/clubs/${activeClubId}/shop/products/${editingProductId}`, {
          ...payload,
          description: productDesc.trim(),
          active: true,
        });
        return res.data as ShopProductRow;
      }
      const res = await api.post(`/clubs/${activeClubId}/shop/products`, payload);
      return res.data as ShopProductRow;
    },
    onSuccess: async (product) => {
      const wasEditing = !!editingProductId;
      const pendingUri = pendingProductPhotoUri;
      resetProductForm();
      queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] });

      if (!wasEditing && product?.id && activeClubId && pendingUri) {
        setUploadingPhotoId(product.id);
        try {
          await uploadShopProductPhotoFromUri(activeClubId, product.id, pendingUri);
          queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] });
          queryClient.invalidateQueries({ queryKey: ['club-shop-all', activeClubId] });
          queryClient.invalidateQueries({ queryKey: ['club-shop-addon', activeClubId] });
          Alert.alert('Listo', 'Producto publicado con foto');
        } catch {
          Alert.alert('Producto publicado', 'No se pudo subir la foto. Podés agregarla después.');
        } finally {
          setUploadingPhotoId(null);
        }
        return;
      }

      if (!wasEditing && product?.id && activeClubId) {
        Alert.alert('Producto publicado', '¿Querés agregar una foto ahora?', [
          { text: 'Después', style: 'cancel' },
          {
            text: 'Agregar foto',
            onPress: () => handleProductPhoto(product.id, !!product.photo_url),
          },
        ]);
        return;
      }
      Alert.alert('Listo', wasEditing ? 'Producto actualizado' : 'Producto publicado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'Error'),
  });

  const handleProductPhoto = (productId: string, hasPhoto: boolean) => {
    if (!activeClubId) return;
    showShopProductPhotoOptions({
      hasPhoto,
      onPick: async (source: ShopProductPhotoSource) => {
        setUploadingPhotoId(productId);
        const url = await pickAndUploadShopProductPhoto(activeClubId, productId, source);
        setUploadingPhotoId(null);
        if (url) {
          queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] });
          queryClient.invalidateQueries({ queryKey: ['club-shop-all', activeClubId] });
          queryClient.invalidateQueries({ queryKey: ['club-shop-addon', activeClubId] });
        }
      },
    });
  };

  const confirmSaleMutation = useMutation({
    mutationFn: async (sale: ShopSaleRow) => {
      if (!activeClubId) throw new Error('Club inválido');
      setConfirmingSaleId(sale.id);
      return confirmShopPurchase(activeClubId, sale.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['club-shop-sales'] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['club-billing-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['club-profile-revenue'] }),
        queryClient.invalidateQueries({ queryKey: ['club-manager-report'] }),
      ]);
      Alert.alert('Listo', 'Venta confirmada en recepción.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo confirmar la venta');
    },
    onSettled: () => setConfirmingSaleId(null),
  });

  const deactivateProduct = useMutation({
    mutationFn: async (productId: string) => {
      if (!activeClubId) return;
      await api.delete(`/clubs/${activeClubId}/shop/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] });
      Alert.alert('Listo', 'Producto eliminado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar'),
  });

  const confirmDeleteProduct = (product: ShopProductRow) => {
    Alert.alert('Eliminar producto', `¿Querés dar de baja "${product.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deactivateProduct.mutate(product.id) },
    ]);
  };

  const toggleMatchExtra = useMutation({
    mutationFn: async ({ productId, enabled }: { productId: string; enabled: boolean }) => {
      if (!activeClubId) return;
      await api.patch(`/clubs/${activeClubId}/shop/products/${productId}`, {
        availableAsMatchExtra: enabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo actualizar'),
  });

  const updateStock = useMutation({
    mutationFn: async ({ productId, stockQuantity }: { productId: string; stockQuantity: number }) => {
      if (!activeClubId) return;
      await api.patch(`/clubs/${activeClubId}/shop/products/${productId}/stock`, { stockQuantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-shop-manage', activeClubId] });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo actualizar'),
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      if (!activeClubId || !couponCode.trim() || !couponLabel.trim()) throw new Error('Completá código y nombre');
      await api.post(`/clubs/${activeClubId}/shop/coupons`, {
        code: couponCode.trim(),
        label: couponLabel.trim(),
        discountPercent: parseInt(couponDiscount, 10) || undefined,
        pointsCost: couponPoints.trim() ? parseInt(couponPoints, 10) : undefined,
      });
    },
    onSuccess: () => {
      setCouponCode('');
      setCouponLabel('');
      setCouponDiscount('10');
      setCouponPoints('');
      setShowCouponForm(false);
      queryClient.invalidateQueries({ queryKey: ['club-shop-coupons', activeClubId] });
      Alert.alert('Listo', 'Cupón creado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'Error'),
  });

  const deactivateCoupon = useMutation({
    mutationFn: async (couponId: string) => {
      if (!activeClubId) return;
      await api.delete(`/clubs/${activeClubId}/shop/coupons/${couponId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-shop-coupons', activeClubId] });
    },
  });

  const resetRewardForm = () => {
    setRewardTitle('');
    setRewardDesc('');
    setRewardPoints('50');
    setEditingRewardId(null);
    setShowRewardForm(false);
  };

  const openEditReward = (reward: RewardRow) => {
    setEditingRewardId(reward.id);
    setRewardTitle(reward.title);
    setRewardDesc(reward.description || '');
    setRewardPoints(String(reward.points_required || 50));
    setShowRewardForm(true);
  };

  const saveReward = useMutation({
    mutationFn: async () => {
      if (!activeClubId || !rewardTitle.trim()) throw new Error('Completá el título');
      const payload = {
        title: rewardTitle.trim(),
        description: rewardDesc.trim() || undefined,
        pointsRequired: parseInt(rewardPoints, 10) || 50,
      };
      if (editingRewardId) {
        const res = await api.patch(`/clubs/${activeClubId}/rewards/${editingRewardId}`, payload);
        return { data: res.data, wasEditing: true };
      }
      const res = await api.post(`/clubs/${activeClubId}/rewards`, payload);
      return { data: res.data, wasEditing: false };
    },
    onSuccess: (result) => {
      resetRewardForm();
      queryClient.invalidateQueries({ queryKey: ['club-rewards-catalog', activeClubId] });
      Alert.alert('Listo', result.wasEditing ? 'Premio actualizado' : 'Premio publicado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo guardar el premio'),
  });

  const deactivateReward = useMutation({
    mutationFn: async (rewardId: string) => {
      if (!activeClubId) return;
      await api.patch(`/clubs/${activeClubId}/rewards/${rewardId}`, { active: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-rewards-catalog', activeClubId] });
      Alert.alert('Listo', 'Premio desactivado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo desactivar'),
  });

  const onRefresh = () => {
    if (tab === 'stats') refetchStats();
    refetchProducts();
    if (tab === 'sales' || tab === 'stats') refetchSales();
    if (tab === 'coupons') refetchCoupons();
    if (tab === 'rewards') {
      refetchRewards();
      refetchRedemptions();
    }
    if (tab === 'redemptions') refetchRedemptions();
  };

  const isLoading =
    (tab === 'stats' && loadingStats) ||
    loadingProducts ||
    (tab === 'sales' && loadingSales) ||
    (tab === 'coupons' && loadingCoupons) ||
    (tab === 'rewards' && loadingRewards) ||
    (tab === 'redemptions' && loadingRedemptions);

  const editingProduct = editingProductId
    ? shopProducts?.find((p) => p.id === editingProductId)
    : null;

  const openBilling = () => {
    if (!activeClubId) return;
    const club = clubs?.find((c) => c.id === activeClubId);
    router.push({
      pathname: '/club-billing',
      params: { clubId: activeClubId, clubName: club?.name || '' },
    } as any);
  };

  const adjustStock = (product: ShopProductRow, delta: number) => {
    const current = product.stock_quantity ?? 0;
    const next = Math.max(0, current + delta);
    updateStock.mutate({ productId: product.id, stockQuantity: next });
  };

  if (!canManage) {
    return (
      <Screen>
        <AppHeader title="Tienda" />
        <EmptyState
          icon={<Ionicons name="storefront-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Esta sección es solo para cuentas de club."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Tienda" />
      <ScrollView
        contentContainerStyle={{ ...tabScreenPadding }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={ui.colors.primary} />}
      >
        {!clubs?.length ? (
          <EmptyState
            icon={<Ionicons name="business-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin clubs"
            description="Creá un club para abrir la tienda."
          />
        ) : (
          <>
            <ClubPicker
              selectedClubId={activeClubId}
              onSelect={setSelectedClubId}
              enabled={canManage}
            />

            <SectionHeader title="Accesos rápidos" />
            <ManagerQuickActions
              actions={[
                {
                  id: 'add-product',
                  label: 'Agregar producto',
                  icon: 'add-circle-outline',
                  onPress: () => {
                    setTab('products');
                    openCreateProduct();
                  },
                },
                {
                  id: 'sale',
                  label: 'Cobros pendientes',
                  icon: 'cash-outline',
                  onPress: () => setTab('sales'),
                },
                {
                  id: 'billing',
                  label: 'Facturación',
                  icon: 'receipt-outline',
                  onPress: openBilling,
                },
                {
                  id: 'inventory',
                  label: 'Ver inventario',
                  icon: 'cube-outline',
                  onPress: () => setTab('products'),
                },
              ]}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>En stock</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.primary, marginTop: 4 }}>
                  {activeProducts.length}
                </Text>
              </AppCard>
              <AppCard style={{ width: '48%', marginBottom: 0 }} padding="sm">
                <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Extras partido</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                  {matchExtraProducts.length}
                </Text>
              </AppCard>
            </View>
            {lowStockCount > 0 && (
              <Text style={{ fontSize: 12, color: ui.colors.warning, marginBottom: 12, fontWeight: '600' }}>
                {lowStockCount} producto{lowStockCount !== 1 ? 's' : ''} con stock bajo
              </Text>
            )}

            <ShopTabBar active={tab} onChange={setTab} />

            {tab === 'stats' && (
              <>
                {pendingSales.length > 0 ? (
                  <AppCard
                    padding="sm"
                    style={{
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: ui.colors.danger,
                      backgroundColor: 'rgba(239,68,68,0.06)',
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: ui.colors.danger }}>
                      {pendingSales.length} cobro{pendingSales.length === 1 ? '' : 's'} pendiente
                      {pendingSales.length === 1 ? '' : 's'} en tienda
                    </Text>
                    <PrimaryButton
                      label="Ir a cobros"
                      size="sm"
                      fullWidth
                      style={{ marginTop: 10 }}
                      onPress={() => setTab('sales')}
                    />
                  </AppCard>
                ) : null}
                <SectionHeader
                  title="Ventas confirmadas"
                  subtitle={`Últimos ${shopStats?.periodDays ?? 30} días`}
                />
                {loadingStats ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando estadísticas...</Text>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                      <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Ganancia</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.primary, marginTop: 4 }}>
                          {formatCurrency(shopStats?.totalRevenue ?? 0)}
                        </Text>
                      </AppCard>
                      <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Ventas</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary, marginTop: 4 }}>
                          {shopStats?.totalSales ?? 0}
                        </Text>
                      </AppCard>
                      <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Más vendido</Text>
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: 14, fontWeight: '700', color: ui.colors.textPrimary, marginTop: 4 }}
                        >
                          {shopStats?.topProduct?.name || '—'}
                        </Text>
                        {shopStats?.topProduct ? (
                          <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                            {shopStats.topProduct.salesCount} ventas
                          </Text>
                        ) : null}
                      </AppCard>
                      <AppCard padding="sm" style={{ width: '48%', marginBottom: 0 }}>
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Extras vendidos</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.accent, marginTop: 4 }}>
                          {shopStats?.extrasSold?.salesCount ?? 0}
                        </Text>
                        <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                          {formatCurrency(shopStats?.extrasSold?.revenue ?? 0)}
                        </Text>
                      </AppCard>
                    </View>

                    {shopStats?.lastSale ? (
                      <AppCard padding="sm" style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, color: ui.colors.textSecondary }}>Última venta</Text>
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginTop: 4 }}>
                          {shopStats.lastSale.productName} · {formatCurrency(shopStats.lastSale.subtotal)}
                        </Text>
                        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                          {formatRelativeTime(shopStats.lastSale.createdAt)} · x{shopStats.lastSale.quantity}
                        </Text>
                      </AppCard>
                    ) : null}

                    {(shopStats?.lowStockCount ?? lowStockCount) > 0 ? (
                      <AppCard padding="sm" style={{ marginBottom: 16 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.warning }}>
                          {shopStats?.lowStockCount ?? lowStockCount} productos con poco stock
                        </Text>
                        <PrimaryButton
                          label="Ver inventario"
                          size="sm"
                          variant="outline"
                          fullWidth
                          style={{ marginTop: 10 }}
                          onPress={() => setTab('products')}
                        />
                      </AppCard>
                    ) : null}

                    {!shopStats?.byCategory?.length ? (
                      <AppCard>
                        <Text style={{ color: ui.colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                          Sin ventas confirmadas en el período. Cuando confirmes compras van a aparecer por categoría.
                        </Text>
                      </AppCard>
                    ) : (
                      shopStats.byCategory.map((row) => (
                        <AppCard key={row.category} padding="sm" style={{ marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>
                                {SHOP_CATEGORY_LABELS[row.category] ?? row.category}
                              </Text>
                              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                                {row.salesCount} venta{row.salesCount === 1 ? '' : 's'}
                              </Text>
                            </View>
                            <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>
                              {formatCurrency(row.revenue)}
                            </Text>
                          </View>
                        </AppCard>
                      ))
                    )}
                  </>
                )}
              </>
            )}

            {tab === 'products' && (
              <>
                {showProductForm ? (
                  <AppCard style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 12 }}>
                      {editingProductId ? 'Editar producto' : 'Nuevo producto'}
                    </Text>
                    <TouchableOpacity
                      onPress={pickPendingProductPhoto}
                      disabled={!!editingProductId && uploadingPhotoId === editingProductId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 14,
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: ui.colors.surfaceAlt,
                      }}
                    >
                      {pendingProductPhotoUri || editingProduct?.photo_url ? (
                        <Image
                          source={{ uri: pendingProductPhotoUri || editingProduct?.photo_url || undefined }}
                          style={{ width: 56, height: 56, borderRadius: 12 }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            backgroundColor: 'rgba(20,184,166,0.12)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="image-outline" size={24} color={ui.colors.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                          {editingProductId && uploadingPhotoId === editingProductId
                            ? 'Subiendo foto...'
                            : pendingProductPhotoUri || editingProduct?.photo_url
                              ? 'Cambiar foto'
                              : 'Agregar foto'}
                        </Text>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                          Galería o cámara
                        </Text>
                      </View>
                      <Ionicons name="camera-outline" size={20} color={ui.colors.primary} />
                    </TouchableOpacity>
                    <InputField label="Nombre" value={productName} onChangeText={setProductName} placeholder="Tubo de pelotas" />
                    <InputField label="Descripción" value={productDesc} onChangeText={setProductDesc} placeholder="Opcional" />
                    <InputField
                      label="Precio (ARS)"
                      value={productPrice}
                      onChangeText={setProductPrice}
                      keyboardType="decimal-pad"
                    />
                    <InputField
                      label="Stock"
                      value={productStock}
                      onChangeText={setProductStock}
                      keyboardType="number-pad"
                      placeholder="Vacío = sin límite"
                    />
                    <TouchableOpacity
                      onPress={() => setProductMatchExtra((v) => !v)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 14,
                        paddingVertical: 4,
                      }}
                    >
                      <MatchExtraCheckbox selected={productMatchExtra} onPress={() => setProductMatchExtra((v) => !v)} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>Extra en partido</Text>
                        <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                          Los jugadores lo verán al reservar o en el detalle del partido
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <SelectionChip label="Cancelar" selected={false} onPress={resetProductForm} flex />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label={editingProductId ? 'Guardar' : 'Publicar'}
                          fullWidth
                          loading={saveShopProduct.isPending}
                          onPress={() => saveShopProduct.mutate()}
                        />
                      </View>
                    </View>
                  </AppCard>
                ) : (
                  <PrimaryButton
                    label="Nuevo producto"
                    variant="outline"
                    fullWidth
                    onPress={openCreateProduct}
                    style={{ marginBottom: 16 }}
                    icon={<Ionicons name="add" size={18} color={ui.colors.primary} />}
                  />
                )}

                {!shopProducts?.length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Cargá tu inventario: pelotas, bebidas, alquiler de paletas y más.
                    </Text>
                  </AppCard>
                ) : (
                  shopProducts.map((p) => {
                    const qty = p.stock_quantity;
                    const isLow = p.active && qty != null && qty <= 3;
                    return (
                      <AppCard key={p.id} padding="sm" style={{ marginBottom: 8, opacity: p.active ? 1 : 0.6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flexDirection: 'row', flex: 1, gap: 10 }}>
                            <TouchableOpacity
                              onPress={() => handleProductPhoto(p.id, !!p.photo_url)}
                              disabled={uploadingPhotoId === p.id}
                            >
                              {p.photo_url ? (
                                <Image
                                  source={{ uri: p.photo_url }}
                                  style={{ width: 52, height: 52, borderRadius: 12 }}
                                />
                              ) : (
                                <View
                                  style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 12,
                                    backgroundColor: 'rgba(20,184,166,0.12)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {uploadingPhotoId === p.id ? (
                                    <Ionicons name="cloud-upload-outline" size={20} color={ui.colors.primary} />
                                  ) : (
                                    <Ionicons name="camera-outline" size={20} color={ui.colors.primary} />
                                  )}
                                </View>
                              )}
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{p.name}</Text>
                                {!p.active && (
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: ui.colors.textMuted }}>INACTIVO</Text>
                                )}
                                {p.available_as_match_extra && p.active && (
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: ui.colors.primary }}>EXTRA PARTIDO</Text>
                                )}
                              </View>
                              {p.description ? (
                                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }} numberOfLines={2}>
                                  {p.description}
                                </Text>
                              ) : null}
                              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                                {formatCurrency(p.price)}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  marginTop: 4,
                                  color: isLow ? ui.colors.accent : ui.colors.textMuted,
                                  fontWeight: isLow ? '700' : '400',
                                }}
                              >
                                Stock: {stockLabel(qty)}
                              </Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 8 }}>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              <TouchableOpacity onPress={() => openEditProduct(p)} style={{ padding: 6 }}>
                                <Ionicons name="create-outline" size={22} color={ui.colors.primary} />
                              </TouchableOpacity>
                              {p.active && (
                                <TouchableOpacity onPress={() => confirmDeleteProduct(p)} style={{ padding: 6 }}>
                                  <Ionicons name="trash-outline" size={22} color={ui.colors.danger} />
                                </TouchableOpacity>
                              )}
                            </View>
                            {p.active && qty != null && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity
                                  onPress={() => adjustStock(p, -1)}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: ui.colors.surface,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Ionicons name="remove" size={18} color={ui.colors.textPrimary} />
                                </TouchableOpacity>
                                <Text style={{ fontWeight: '800', fontSize: 14, minWidth: 24, textAlign: 'center' }}>
                                  {qty}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => adjustStock(p, 1)}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: ui.colors.primary,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Ionicons name="add" size={18} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      </AppCard>
                    );
                  })
                )}
              </>
            )}

            {tab === 'sales' && (
              <>
                <SectionHeader
                  title="Cobros de tienda"
                  subtitle="Confirmá en recepción sin bloquear otras canchas"
                />
                {pendingSales.length > 0 ? (
                  <AppCard padding="sm" style={{ marginBottom: 12, borderWidth: 1, borderColor: ui.colors.danger }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.danger }}>
                      {pendingSales.length} pendiente{pendingSales.length === 1 ? '' : 's'} de cobro
                    </Text>
                  </AppCard>
                ) : null}
                {loadingSales ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando ventas...</Text>
                ) : !(shopSales || []).length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                      Todavía no hay pedidos de tienda. Cuando un jugador pida productos, van a aparecer acá para
                      marcarlos como cobrados.
                    </Text>
                  </AppCard>
                ) : (
                  (shopSales || []).map((sale) => {
                    const pending = sale.status === 'PENDING';
                    return (
                      <AppCard
                        key={sale.id}
                        padding="sm"
                        style={{
                          marginBottom: 8,
                          borderWidth: pending ? 1 : 0,
                          borderColor: pending ? ui.colors.danger : 'transparent',
                          backgroundColor: pending ? 'rgba(239,68,68,0.06)' : undefined,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                              {sale.quantity}x {sale.product_name}
                            </Text>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                              {sale.user_name}
                              {sale.match_title ? ` · ${sale.match_title}` : ''}
                            </Text>
                            <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginTop: 2 }}>
                              {formatShortDate(sale.created_at)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                marginTop: 4,
                                color: pending ? ui.colors.danger : ui.colors.success,
                              }}
                            >
                              {pending ? 'Pendiente de cobro' : sale.status === 'CONFIRMED' ? 'Cobrado' : sale.status}
                            </Text>
                          </View>
                          <Text style={{ fontWeight: '800', color: ui.colors.primary }}>
                            {formatCurrency(sale.subtotal)}
                          </Text>
                        </View>
                        {pending ? (
                          <PrimaryButton
                            label="Confirmar cobro"
                            size="sm"
                            fullWidth
                            loading={confirmingSaleId === sale.id && confirmSaleMutation.isPending}
                            style={{ marginTop: 10 }}
                            onPress={() => {
                              Alert.alert(
                                'Confirmar cobro',
                                `¿${sale.user_name} pagó ${formatCurrency(sale.subtotal)} por ${sale.product_name}?`,
                                [
                                  { text: 'Cancelar', style: 'cancel' },
                                  { text: 'Cobrado', onPress: () => confirmSaleMutation.mutate(sale) },
                                ],
                              );
                            }}
                          />
                        ) : null}
                      </AppCard>
                    );
                  })
                )}
                <PrimaryButton
                  label="Ver señas y facturación"
                  variant="outline"
                  fullWidth
                  style={{ marginTop: 8 }}
                  onPress={openBilling}
                  icon={<Ionicons name="receipt-outline" size={18} color={ui.colors.primary} />}
                />
              </>
            )}

            {tab === 'matchExtras' && (
              <>
                <SectionHeader
                  title="Extras en partidos"
                  subtitle="Marcá qué productos del stock ofrecer al jugar"
                />
                {!activeProducts.length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Primero cargá productos en la pestaña Stock.
                    </Text>
                  </AppCard>
                ) : (
                  activeProducts.map((product) => {
                    const checked = !!product.available_as_match_extra;
                    return (
                      <AppCard key={product.id} padding="sm" style={{ marginBottom: 8 }}>
                        <TouchableOpacity
                          onPress={() =>
                            toggleMatchExtra.mutate({ productId: product.id, enabled: !checked })
                          }
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                          disabled={toggleMatchExtra.isPending}
                        >
                          <MatchExtraCheckbox
                            selected={checked}
                            onPress={() =>
                              toggleMatchExtra.mutate({ productId: product.id, enabled: !checked })
                            }
                            disabled={toggleMatchExtra.isPending}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{product.name}</Text>
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                              {formatCurrency(product.price)} · Stock: {stockLabel(product.stock_quantity)}
                            </Text>
                          </View>
                          {checked && (
                            <Ionicons name="tennisball-outline" size={20} color={ui.colors.primary} />
                          )}
                        </TouchableOpacity>
                      </AppCard>
                    );
                  })
                )}
                {matchExtraProducts.length > 0 && (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 8 }}>
                    {`${matchExtraProducts.length} producto${matchExtraProducts.length !== 1 ? 's' : ''} visible${matchExtraProducts.length !== 1 ? 's' : ''} en partidos`}
                  </Text>
                )}
              </>
            )}

            {tab === 'coupons' && (
              <>
                {showCouponForm ? (
                  <AppCard style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 12 }}>Nuevo cupón</Text>
                    <InputField label="Código" value={couponCode} onChangeText={setCouponCode} placeholder="VERANO20" autoCapitalize="characters" />
                    <InputField label="Nombre" value={couponLabel} onChangeText={setCouponLabel} placeholder="20% en tienda" />
                    <InputField
                      label="Descuento (%)"
                      value={couponDiscount}
                      onChangeText={setCouponDiscount}
                      keyboardType="number-pad"
                    />
                    <InputField
                      label="Costo en puntos (opcional)"
                      value={couponPoints}
                      onChangeText={setCouponPoints}
                      keyboardType="number-pad"
                      placeholder="Canje por ranking"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <SelectionChip label="Cancelar" selected={false} onPress={() => setShowCouponForm(false)} flex />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label="Crear cupón"
                          fullWidth
                          loading={createCoupon.isPending}
                          onPress={() => createCoupon.mutate()}
                        />
                      </View>
                    </View>
                  </AppCard>
                ) : (
                  <PrimaryButton
                    label="Nuevo cupón"
                    variant="outline"
                    fullWidth
                    onPress={() => setShowCouponForm(true)}
                    style={{ marginBottom: 16 }}
                    icon={<Ionicons name="pricetag" size={18} color={ui.colors.primary} />}
                  />
                )}

                {!activeCoupons.length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Creá cupones de descuento o canjeables por puntos.
                    </Text>
                  </AppCard>
                ) : (
                  activeCoupons.map((coupon) => (
                    <AppCard key={coupon.id} padding="sm" style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '800', color: ui.colors.primary }}>{coupon.code}</Text>
                          <Text style={{ fontWeight: '600', color: ui.colors.textPrimary, marginTop: 4 }}>{coupon.label}</Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                            {coupon.discount_percent ? `${coupon.discount_percent}% off` : ''}
                            {coupon.points_cost ? `${coupon.discount_percent ? ' · ' : ''}${coupon.points_cost} pts` : ''}
                            {coupon.max_uses ? ` · ${coupon.uses_count}/${coupon.max_uses} usos` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => deactivateCoupon.mutate(coupon.id)}>
                          <Ionicons name="trash-outline" size={20} color={ui.colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </AppCard>
                  ))
                )}
              </>
            )}

            {tab === 'rewards' && (
              <>
                <SectionHeader
                  title="Catálogo de premios"
                  subtitle="Canjeables por puntos del club"
                  action={
                    !showRewardForm ? (
                      <TouchableOpacity onPress={() => setShowRewardForm(true)}>
                        <Text style={{ color: ui.colors.primary, fontSize: 13, fontWeight: '600' }}>Crear</Text>
                      </TouchableOpacity>
                    ) : null
                  }
                />

                {showRewardForm ? (
                  <AppCard style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 12 }}>
                      {editingRewardId ? 'Editar premio' : 'Crear premio'}
                    </Text>
                    <InputField
                      label="Título"
                      value={rewardTitle}
                      onChangeText={setRewardTitle}
                      placeholder="Ej: 1 hora gratis"
                    />
                    <InputField
                      label="Descripción"
                      value={rewardDesc}
                      onChangeText={setRewardDesc}
                      placeholder="Detalle del beneficio"
                    />
                    <InputField
                      label="Puntos necesarios"
                      value={rewardPoints}
                      onChangeText={setRewardPoints}
                      keyboardType="number-pad"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <SelectionChip label="Cancelar" selected={false} onPress={resetRewardForm} flex />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PrimaryButton
                          label={editingRewardId ? 'Guardar' : 'Publicar'}
                          fullWidth
                          loading={saveReward.isPending}
                          onPress={() => saveReward.mutate()}
                        />
                      </View>
                    </View>
                  </AppCard>
                ) : (
                  <PrimaryButton
                    label="Crear premio"
                    variant="outline"
                    fullWidth
                    onPress={() => setShowRewardForm(true)}
                    style={{ marginBottom: 16 }}
                    icon={<Ionicons name="gift-outline" size={18} color={ui.colors.primary} />}
                  />
                )}

                {loadingRewards ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando premios...</Text>
                ) : !rewards?.length ? (
                  <AppCard style={{ marginBottom: 16 }}>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Creá recompensas para motivar a los jugadores del club.
                    </Text>
                  </AppCard>
                ) : (
                  rewards.map((reward) => (
                    <AppCard
                      key={reward.id}
                      padding="sm"
                      style={{ marginBottom: 8, opacity: reward.active ? 1 : 0.6 }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{reward.title}</Text>
                          {reward.description ? (
                            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                              {reward.description}
                            </Text>
                          ) : null}
                          <Text
                            style={{
                              fontSize: 13,
                              color: ui.colors.primary,
                              fontWeight: '700',
                              marginTop: 8,
                            }}
                          >
                            {reward.points_required} puntos
                            {!reward.active ? ' · inactivo' : ''}
                          </Text>
                        </View>
                        {reward.active ? (
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => openEditReward(reward)}>
                              <Ionicons name="create-outline" size={20} color={ui.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                Alert.alert('Desactivar premio', `¿Ocultar "${reward.title}" del catálogo?`, [
                                  { text: 'Cancelar', style: 'cancel' },
                                  {
                                    text: 'Desactivar',
                                    style: 'destructive',
                                    onPress: () => deactivateReward.mutate(reward.id),
                                  },
                                ])
                              }
                            >
                              <Ionicons name="eye-off-outline" size={20} color={ui.colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    </AppCard>
                  ))
                )}
              </>
            )}

            {tab === 'redemptions' && (
              <>
                <SectionHeader title="Canjes por puntos" subtitle="Premios del ranking canjeados" />
                {loadingRedemptions ? (
                  <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Cargando canjes...</Text>
                ) : !redemptions?.length ? (
                  <AppCard>
                    <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
                      Cuando un jugador canjee un premio con sus puntos, aparecerá acá.
                    </Text>
                  </AppCard>
                ) : (
                  redemptions.map((item) => (
                    <AppCard key={item.id} padding="sm" style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{item.reward_title}</Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                            {item.user_nickname || item.user_name} · {item.points_spent} pts
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>{formatRelativeTime(item.created_at)}</Text>
                      </View>
                    </AppCard>
                  ))
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
