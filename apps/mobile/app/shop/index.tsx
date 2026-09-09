import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  SectionHeader,
  PrimaryButton,
  EmptyState,
} from '@/components/padely';

type PlatformProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  currency?: string;
  photo_url?: string | null;
  stock_quantity?: number | null;
  category?: string;
  sponsor_name?: string | null;
  sponsor_logo_url?: string | null;
};

type PlatformOrder = {
  id: string;
  status: string;
  total: number | string;
  created_at: string;
  items?: Array<{ product_name?: string; quantity: number; subtotal: number | string }>;
};

export default function PlatformShopScreen() {
  const queryClient = useQueryClient();
  const [orderingId, setOrderingId] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['platform-shop-products'],
    queryFn: async () => {
      const res = await api.get('/shop/products');
      return res.data as PlatformProduct[];
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['platform-shop-orders'],
    queryFn: async () => {
      const res = await api.get('/shop/orders/me');
      return res.data as PlatformOrder[];
    },
  });

  const orderMutation = useMutation({
    mutationFn: async (productId: string) => {
      const orderRes = await api.post('/shop/orders', { productId, quantity: 1 });
      const order = orderRes.data as PlatformOrder;
      await api.post(`/shop/orders/${order.id}/pay/simulate`);
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-shop-products'] });
      queryClient.invalidateQueries({ queryKey: ['platform-shop-orders'] });
      Alert.alert('Compra registrada', 'Te vamos a contactar para coordinar entrega.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo completar la compra');
    },
    onSettled: () => setOrderingId(null),
  });

  const refreshing = productsQuery.isRefetching || ordersQuery.isRefetching;

  return (
    <Screen>
      <StackHeader title="Shop x4" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              productsQuery.refetch();
              ordersQuery.refetch();
            }}
          />
        }
      >
        <Text style={{ color: ui.colors.textSecondary, marginBottom: ui.spacing.md, fontSize: 14 }}>
          Productos de patrocinadores. La tienda del club sigue en cada sede.
        </Text>

        <SectionHeader title="Catálogo" dark />
        {productsQuery.isLoading ? (
          <ActivityIndicator color={ui.colors.primary} />
        ) : !productsQuery.data?.length ? (
          <EmptyState
            icon={<Ionicons name="bag-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin productos"
            description="Pronto vas a ver ofertas de sponsors acá."
          />
        ) : (
          productsQuery.data.map((product) => (
            <AppCard key={product.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {product.photo_url ? (
                  <Image
                    source={{ uri: product.photo_url }}
                    style={{ width: 72, height: 72, borderRadius: 12 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 12,
                      backgroundColor: ui.colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="shirt-outline" size={28} color={ui.colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{product.name}</Text>
                  {product.sponsor_name ? (
                    <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                      {product.sponsor_name}
                    </Text>
                  ) : null}
                  {product.description ? (
                    <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginTop: 6 }}>
                      {product.description}
                    </Text>
                  ) : null}
                  <Text style={{ fontWeight: '700', color: ui.colors.primary, marginTop: 8 }}>
                    {formatCurrency(Number(product.price))}
                  </Text>
                </View>
              </View>
              <PrimaryButton
                label="Comprar"
                size="sm"
                fullWidth
                style={{ marginTop: 12 }}
                loading={orderingId === product.id && orderMutation.isPending}
                onPress={() => {
                  setOrderingId(product.id);
                  Alert.alert('Confirmar compra', `¿Comprar ${product.name}?`, [
                    { text: 'Cancelar', style: 'cancel', onPress: () => setOrderingId(null) },
                    { text: 'Comprar', onPress: () => orderMutation.mutate(product.id) },
                  ]);
                }}
              />
            </AppCard>
          ))
        )}

        <SectionHeader title="Mis pedidos" dark />
        {!ordersQuery.data?.length ? (
          <AppCard>
            <Text style={{ color: ui.colors.textMuted, fontSize: 13 }}>Todavía no hiciste pedidos.</Text>
          </AppCard>
        ) : (
          ordersQuery.data.map((order) => (
            <AppCard key={order.id} style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                {formatCurrency(Number(order.total))} · {order.status}
              </Text>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                {(order.items || []).map((i) => i.product_name).filter(Boolean).join(', ') || 'Pedido'}
              </Text>
            </AppCard>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
