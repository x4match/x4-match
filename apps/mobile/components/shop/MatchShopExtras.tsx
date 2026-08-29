import { View, Text, Alert, ActivityIndicator, Image } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { confirmShopPurchase } from '@/lib/shop-api';
import { ui } from '@/theme/tokens';
import { AppCard, PrimaryButton, SectionHeader } from '@/components/padely';

export interface ShopProduct {
  id: string;
  name: string;
  description?: string;
  price: number | string;
  kind: string;
  category: string;
  photo_url?: string | null;
}

interface ShopPurchase {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
  status: string;
  user_name?: string;
  nickname?: string;
}

type MatchShopExtrasProps = {
  matchId: string;
  clubId: string;
  currentUserId?: string;
  canAdd: boolean;
  /** Cuenta club: puede confirmar cobros pendientes en recepción */
  canConfirmPayments?: boolean;
};

export function MatchShopExtras({
  matchId,
  clubId,
  currentUserId,
  canAdd,
  canConfirmPayments,
}: MatchShopExtrasProps) {
  const queryClient = useQueryClient();

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['club-shop-addon', clubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${clubId}/shop/products`, { params: { matchExtra: 'true' } });
      return res.data as ShopProduct[];
    },
    enabled: !!clubId,
  });

  const { data: cart, isLoading: loadingCart } = useQuery({
    queryKey: ['match-shop', matchId],
    queryFn: async () => {
      const res = await api.get(`/matches/${matchId}/shop`);
      return res.data as { items: ShopPurchase[]; total: number };
    },
    enabled: !!matchId,
  });

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await api.post(`/matches/${matchId}/shop/items`, { productId, quantity: 1 });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-shop', matchId] });
      queryClient.invalidateQueries({ queryKey: ['club-shop-sales', clubId] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo agregar');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await api.delete(`/matches/${matchId}/shop/items/${purchaseId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['match-shop', matchId] }),
  });

  const confirmMutation = useMutation({
    mutationFn: (purchaseId: string) => confirmShopPurchase(clubId, purchaseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['match-shop', matchId] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-sales'] }),
        queryClient.invalidateQueries({ queryKey: ['club-shop-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['club-billing-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['club-profile-revenue'] }),
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo confirmar el cobro');
    },
  });

  const allItems = cart?.items || [];

  if (loadingProducts && loadingCart) {
    return <ActivityIndicator color={ui.colors.primary} style={{ marginVertical: 12 }} />;
  }

  if (!products?.length && !allItems.length) {
    return null;
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <SectionHeader
        title="Extras del partido"
        subtitle="Pelotas, alquileres y más — pagás en recepción"
        dark
      />

      {canAdd && products && products.length > 0 && (
        <AppCard style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12 }}>
            Sumá productos al partido (ej. tubo de pelotas):
          </Text>
          {products.map((product) => (
            <View
              key={product.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderBottomColor: ui.colors.border,
              }}
            >
              {product.photo_url ? (
                <Image source={{ uri: product.photo_url }} style={{ width: 40, height: 40, borderRadius: 10 }} />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: 'rgba(20,184,166,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="tennisball" size={18} color={ui.colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{product.name}</Text>
                {product.description ? (
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                    {product.description}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 13, fontWeight: '700', color: ui.colors.primary, marginTop: 4 }}>
                  {formatCurrency(product.price)}
                </Text>
              </View>
              <PrimaryButton
                label="Sumar"
                size="sm"
                disabled={addMutation.isPending}
                onPress={() => addMutation.mutate(product.id)}
                icon={<Ionicons name="add" size={16} color="#fff" />}
              />
            </View>
          ))}
        </AppCard>
      )}

      {allItems.length > 0 && (
        <AppCard>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, marginBottom: 10 }}>
            Pedidos del partido
          </Text>
          {allItems.map((item) => {
            const isMine = item.user_id === currentUserId;
            const pending = item.status === 'PENDING';
            return (
              <View
                key={item.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                  gap: 8,
                  padding: pending ? 8 : 0,
                  borderRadius: 10,
                  backgroundColor: pending && canConfirmPayments ? 'rgba(239,68,68,0.06)' : undefined,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ui.colors.textPrimary, fontWeight: '600' }}>
                    {item.quantity}x {item.product_name}
                  </Text>
                  <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                    {item.nickname || item.user_name}
                    {isMine ? ' (vos)' : ''}
                    {pending ? ' · Pendiente' : item.status === 'CONFIRMED' ? ' · Cobrado' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>
                    {formatCurrency(item.subtotal)}
                  </Text>
                  {isMine && canAdd && pending && (
                    <PrimaryButton
                      label="Quitar"
                      size="sm"
                      variant="ghost"
                      onPress={() => removeMutation.mutate(item.id)}
                      style={{ marginTop: 4, paddingHorizontal: 8 }}
                    />
                  )}
                  {canConfirmPayments && pending && (
                    <PrimaryButton
                      label="Cobrado"
                      size="sm"
                      loading={confirmMutation.isPending}
                      onPress={() => {
                        Alert.alert(
                          'Confirmar cobro',
                          `¿Confirmás el pago de ${formatCurrency(item.subtotal)}?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Cobrado', onPress: () => confirmMutation.mutate(item.id) },
                          ],
                        );
                      }}
                      style={{ marginTop: 4 }}
                    />
                  )}
                </View>
              </View>
            );
          })}
          <View
            style={{
              marginTop: 8,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: ui.colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Total partido</Text>
            <Text style={{ fontWeight: '800', color: ui.colors.primary, fontSize: 16 }}>
              {formatCurrency(cart?.total ?? 0)}
            </Text>
          </View>
        </AppCard>
      )}
    </View>
  );
}
