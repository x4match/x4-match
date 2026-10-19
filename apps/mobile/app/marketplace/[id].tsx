import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import {
  LISTING_CATEGORIES,
  MARKETPLACE_QUERY_KEY,
  MY_LISTINGS_QUERY_KEY,
  deleteListing,
  fetchListing,
  listingConditionLabel,
  listingQueryKey,
  sellerDisplayName,
  updateListing,
  type ListingStatus,
  type PlayerListingRow,
} from '@/lib/shop/player-marketplace';
import { fontFamily } from '@/theme/tokens';
import { Avatar, EmptyState, PrimaryButton, Screen, StackHeader } from '@/components/x4match';
import { SHOP_CARD_BG, SHOP_GLASS, SHOP_IMAGE_BG, SHOP_LIME, SHOP_MUTED } from '@/components/shop/marketplace/theme';

type MessageAccess = {
  canMessage: boolean;
  conversationId?: string;
  reason?: string;
  canSendRequest?: boolean;
};

const BLOCKED_CHAT_MESSAGES: Record<string, string> = {
  blocked: 'No podés enviarle mensajes a este jugador.',
  rejected: 'El vendedor rechazó tu solicitud de mensaje.',
  pending_outgoing: 'Ya le enviaste una solicitud de mensaje. Esperá a que la acepte.',
  pending_incoming: 'Tenés una solicitud de mensaje de este jugador. Aceptala desde Mensajes.',
};

function Gallery({ photos, width, category }: { photos: string[]; width: number; category: string }) {
  const [index, setIndex] = useState(0);
  const icon = LISTING_CATEGORIES.find((c) => c.value === category)?.icon ?? 'bag-handle-outline';

  if (!photos.length) {
    return (
      <View style={[styles.galleryEmpty, { width, height: width }]}>
        <Ionicons name={icon} size={Math.round(width * 0.25)} color="#3A3A44" />
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {photos.map((uri) => (
          <Image key={uri} source={{ uri }} style={{ width, height: width, backgroundColor: SHOP_IMAGE_BG }} />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((uri, i) => (
            <View key={uri} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function InfoChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.infoChip}>
      <Ionicons name={icon} size={13} color={SHOP_LIME} />
      <Text style={styles.infoChipText}>{label}</Text>
    </View>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [contacting, setContacting] = useState(false);

  const listingQuery = useQuery({
    queryKey: listingQueryKey(id),
    queryFn: () => fetchListing(id),
    enabled: !!id,
  });
  const listing = listingQuery.data;
  const isOwner = !!user && listing?.seller_user_id === user.id;

  const statusMutation = useMutation({
    mutationFn: (status: ListingStatus) => updateListing(id, { status }),
    onSuccess: (updated: PlayerListingRow) => {
      queryClient.setQueryData(listingQueryKey(id), updated);
      queryClient.invalidateQueries({ queryKey: MARKETPLACE_QUERY_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: MY_LISTINGS_QUERY_KEY });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MARKETPLACE_QUERY_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: MY_LISTINGS_QUERY_KEY });
      router.back();
      queryClient.removeQueries({ queryKey: listingQueryKey(id) });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo eliminar'),
  });

  const contactSeller = async () => {
    if (!listing) return;
    const sellerId = listing.seller_user_id;
    const sellerName = sellerDisplayName(listing);
    const draft = `¡Hola! Vi tu publicación "${listing.title}" en el marketplace de x4 Match. ¿Sigue disponible?`;
    const goToChat = (conversationId: string) =>
      router.push({
        pathname: `/conversation/${conversationId}` as any,
        params: { name: sellerName, status: 'active', userId: sellerId, draft },
      });

    setContacting(true);
    try {
      const access = (await api.get(`/conversations/access/${sellerId}`)).data as MessageAccess;
      if (access.canMessage && access.conversationId) {
        goToChat(access.conversationId);
        return;
      }
      if (access.canMessage || access.canSendRequest) {
        const res = await api.post(`/conversations/request/${sellerId}`);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        if (res.data?.status === 'active' && res.data?.conversationId) {
          goToChat(res.data.conversationId);
        } else {
          Alert.alert(
            'Solicitud enviada',
            `Le enviamos una solicitud de mensaje a ${sellerName}. Cuando la acepte vas a poder chatear.`,
          );
        }
        return;
      }
      Alert.alert('No disponible', BLOCKED_CHAT_MESSAGES[access.reason ?? ''] ?? 'No podés contactar a este vendedor.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo abrir el chat');
    } finally {
      setContacting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Eliminar publicación', '¿Querés eliminarla? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (listingQuery.isLoading) {
    return (
      <Screen>
        <StackHeader title="Publicación" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={SHOP_LIME} />
        </View>
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen>
        <StackHeader title="Publicación" />
        <EmptyState
          icon={<Ionicons name="pricetags-outline" size={32} color={SHOP_MUTED} />}
          title="Publicación no disponible"
          description="Puede que el vendedor la haya eliminado o pausado."
        />
      </Screen>
    );
  }

  const sellerName = sellerDisplayName(listing);
  const categoryLabel = LISTING_CATEGORIES.find((c) => c.value === listing.category)?.label ?? 'Otros';
  const sold = listing.status === 'SOLD';
  const paused = listing.status === 'PAUSED';
  const busy = statusMutation.isPending || deleteMutation.isPending;

  return (
    <Screen>
      <StackHeader
        title="Publicación"
        rightAction={
          isOwner ? (
            <Pressable
              onPress={() => router.push({ pathname: '/marketplace/sell', params: { id: listing.id } } as any)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Editar publicación"
            >
              <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View>
          <Gallery photos={listing.photo_urls ?? []} width={width} category={listing.category} />
          {sold || paused ? (
            <View style={styles.statusOverlay}>
              <Text style={styles.statusOverlayText}>{sold ? 'VENDIDO' : 'PAUSADO'}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.eyebrow}>
              {categoryLabel} · Publicado {formatRelativeTime(listing.created_at)}
            </Text>
            <Text style={styles.title}>{listing.title}</Text>
            <Text style={styles.price}>{formatCurrency(listing.price, listing.currency)}</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <InfoChip icon="sparkles-outline" label={listingConditionLabel(listing.condition)} />
            <InfoChip icon="pricetag-outline" label={categoryLabel} />
            {listing.city ? <InfoChip icon="location-outline" label={listing.city} /> : null}
          </View>

          {listing.description ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionLabel}>Descripción</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>Vendedor</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/player/[id]', params: { id: listing.seller_user_id } } as any)}
              accessibilityRole="button"
              accessibilityLabel={`Ver perfil de ${sellerName}`}
              style={({ pressed }) => [styles.sellerCard, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Avatar name={listing.seller_name} photo={listing.seller_photo_url} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sellerName}>{sellerName}</Text>
                <Text style={styles.sellerHint}>{isOwner ? 'Sos vos' : 'Ver perfil del jugador'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SHOP_MUTED} />
            </Pressable>
          </View>

          {isOwner ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>Gestionar</Text>
              {sold ? (
                <PrimaryButton
                  label="Volver a publicar"
                  variant="outline"
                  fullWidth
                  loading={statusMutation.isPending}
                  disabled={busy}
                  onPress={() => statusMutation.mutate('ACTIVE')}
                />
              ) : (
                <>
                  <PrimaryButton
                    label="Marcar como vendido"
                    fullWidth
                    loading={statusMutation.isPending && statusMutation.variables === 'SOLD'}
                    disabled={busy}
                    onPress={() => statusMutation.mutate('SOLD')}
                  />
                  <PrimaryButton
                    label={paused ? 'Reactivar publicación' : 'Pausar publicación'}
                    variant="outline"
                    fullWidth
                    loading={statusMutation.isPending && statusMutation.variables !== 'SOLD'}
                    disabled={busy}
                    onPress={() => statusMutation.mutate(paused ? 'ACTIVE' : 'PAUSED')}
                  />
                </>
              )}
              <PrimaryButton
                label="Eliminar publicación"
                variant="ghost"
                fullWidth
                loading={deleteMutation.isPending}
                disabled={busy}
                onPress={confirmDelete}
              />
            </View>
          ) : (
            <View style={[SHOP_GLASS, { flexDirection: 'row', gap: 10, padding: 12 }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={SHOP_LIME} />
              <Text style={[styles.sellerHint, { flex: 1, lineHeight: 17 }]}>
                Preferí encontrarte en un club o lugar público, revisá el producto antes de pagar y nunca envíes
                dinero por adelantado a alguien que no conocés.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {!isOwner && !sold ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomPrice} numberOfLines={1}>
              {formatCurrency(listing.price, listing.currency)}
            </Text>
            <Text style={styles.sellerHint} numberOfLines={1}>
              Vende {sellerName}
            </Text>
          </View>
          <Pressable
            onPress={contactSeller}
            disabled={contacting}
            accessibilityRole="button"
            accessibilityLabel="Contactar al vendedor"
            style={({ pressed }) => [styles.contactButton, { opacity: pressed || contacting ? 0.8 : 1 }]}
          >
            {contacting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses" size={16} color="#000" />
                <Text style={styles.contactText}>Contactar</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  galleryEmpty: {
    backgroundColor: SHOP_IMAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 18,
    backgroundColor: SHOP_LIME,
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: fontFamily.bold,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  eyebrow: {
    color: SHOP_MUTED,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fontFamily.regular,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
    fontFamily: fontFamily.bold,
  },
  price: {
    color: SHOP_LIME,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  infoChipText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: fontFamily.regular,
  },
  sectionLabel: {
    color: SHOP_MUTED,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: fontFamily.regular,
  },
  description: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fontFamily.regular,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: SHOP_CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sellerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
  },
  sellerHint: {
    color: SHOP_MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fontFamily.regular,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(11,11,15,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bottomPrice: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 150,
    height: 48,
    borderRadius: 999,
    backgroundColor: SHOP_LIME,
    paddingHorizontal: 20,
  },
  contactText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
});
