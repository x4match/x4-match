import { useState } from 'react';
import { View, Text, Alert, ActivityIndicator, Image } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { ui } from '@/theme/tokens';
import { AppCard, PrimaryButton, SectionHeader } from '@/components/padely';
import type { ShopProduct } from './MatchShopExtras';

type ClubShopCatalogProps = {
  clubId: string;
  canPurchase: boolean;
  matchId?: string;
};

export function ClubShopCatalog({ clubId, canPurchase, matchId }: ClubShopCatalogProps) {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<Record<string, number>>({});

  const { data: products, isLoading } = useQuery({
    queryKey: ['club-shop-all', clubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${clubId}/shop/products`);
      return res.data as ShopProduct[];
    },
    enabled: !!clubId,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));
      const res = await api.post(`/clubs/${clubId}/shop/checkout`, {
        items,
        matchId: matchId || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCart({});
      queryClient.invalidateQueries({ queryKey: ['match-shop', matchId] });
      queryClient.invalidateQueries({ queryKey: ['club-shop-sales', clubId] });
      queryClient.invalidateQueries({ queryKey: ['club-billing-movements'] });
      queryClient.invalidateQueries({ queryKey: ['club-profile-revenue'] });
      Alert.alert(
        'Pedido registrado',
        `Total: ${formatCurrency(data.total)}\nPagá en recepción del club.`,
      );
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo completar el pedido');
    },
  });

  const addToCart = (productId: string) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const cartTotal =
    products?.reduce((sum, p) => {
      const qty = cart[p.id] || 0;
      return sum + qty * Number(p.price);
    }, 0) ?? 0;

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  if (isLoading) {
    return <ActivityIndicator color={ui.colors.primary} style={{ marginVertical: 16 }} />;
  }

  if (!products?.length) {
    return (
      <AppCard>
        <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
          Este club todavía no publicó productos en la tienda.
        </Text>
      </AppCard>
    );
  }

  const renderList = (list: ShopProduct[]) => {
    if (!list.length) return null;
    return list.map((product) => (
      <View
        key={product.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          paddingBottom: 12,
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
            <Ionicons
              name={product.category === 'BALLS' ? 'tennisball' : 'cart'}
              size={20}
              color={ui.colors.primary}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{product.name}</Text>
          {product.description ? (
            <Text style={{ fontSize: 12, color: ui.colors.textMuted }}>{product.description}</Text>
          ) : null}
          <Text style={{ fontSize: 13, fontWeight: '700', color: ui.colors.primary, marginTop: 4 }}>
            {formatCurrency(product.price)}
            {cart[product.id] ? ` · x${cart[product.id]} en carrito` : ''}
          </Text>
        </View>
        {canPurchase ? <PrimaryButton label="+" size="sm" onPress={() => addToCart(product.id)} /> : null}
      </View>
    ));
  };

  return (
    <View>
      <SectionHeader title="Tienda del club" subtitle="Productos del stock" dark />
      <AppCard>
        {renderList(products)}
        {canPurchase && cartCount > 0 ? (
          <PrimaryButton
            label={`Confirmar pedido · ${formatCurrency(cartTotal)}`}
            fullWidth
            onPress={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
            style={{ marginTop: 12 }}
            icon={<Ionicons name="bag-check" size={18} color="#fff" />}
          />
        ) : null}
      </AppCard>
    </View>
  );
}
