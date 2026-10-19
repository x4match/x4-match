import { useMemo } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import {
  LISTING_CATEGORIES,
  LISTING_STATUS_LABELS,
  MY_LISTINGS_QUERY_KEY,
  fetchMyListings,
  listingConditionLabel,
  type ListingStatus,
  type PlayerListingRow,
} from '@/lib/shop/player-marketplace';
import { fontFamily } from '@/theme/tokens';
import { EmptyState, PrimaryButton, Screen, StackHeader } from '@/components/x4match';
import { SHOP_CARD_BG, SHOP_IMAGE_BG, SHOP_LIME, SHOP_MUTED } from '@/components/shop/marketplace/theme';

const STATUS_COLORS: Record<ListingStatus, string> = {
  ACTIVE: SHOP_LIME,
  PAUSED: '#F59E0B',
  SOLD: SHOP_MUTED,
};

const SECTIONS: { status: ListingStatus; title: string }[] = [
  { status: 'ACTIVE', title: 'Publicadas' },
  { status: 'PAUSED', title: 'Pausadas' },
  { status: 'SOLD', title: 'Vendidas' },
];

function ListingRow({ listing, onPress }: { listing: PlayerListingRow; onPress: () => void }) {
  const photo = listing.photo_urls?.[0];
  const icon = LISTING_CATEGORIES.find((c) => c.value === listing.category)?.icon ?? 'bag-handle-outline';
  const color = STATUS_COLORS[listing.status];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${LISTING_STATUS_LABELS[listing.status]}`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : listing.status === 'SOLD' ? 0.7 : 1 }]}
    >
      <View style={styles.thumb}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
        ) : (
          <Ionicons name={icon} size={26} color="#3A3A44" />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatCurrency(listing.price, listing.currency)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {listingConditionLabel(listing.condition)} · {formatRelativeTime(listing.created_at)}
        </Text>
      </View>
      <View style={[styles.status, { borderColor: color }]}>
        <Text style={[styles.statusText, { color }]}>{LISTING_STATUS_LABELS[listing.status]}</Text>
      </View>
    </Pressable>
  );
}

export default function MyListingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const listingsQuery = useQuery({
    queryKey: MY_LISTINGS_QUERY_KEY,
    queryFn: fetchMyListings,
  });

  const grouped = useMemo(() => {
    const rows = listingsQuery.data ?? [];
    return SECTIONS.map((section) => ({
      ...section,
      rows: rows.filter((r) => r.status === section.status),
    })).filter((section) => section.rows.length > 0);
  }, [listingsQuery.data]);

  const openSell = () => router.push('/marketplace/sell' as any);

  return (
    <Screen>
      <StackHeader title="Mis publicaciones" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 18 }}
        refreshControl={
          <RefreshControl
            refreshing={listingsQuery.isRefetching}
            onRefresh={() => listingsQuery.refetch()}
            tintColor={SHOP_LIME}
          />
        }
      >
        <PrimaryButton
          label="Nueva publicación"
          fullWidth
          onPress={openSell}
          icon={<Ionicons name="add" size={18} color="#000" />}
        />

        {listingsQuery.isLoading ? null : grouped.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="pricetags-outline" size={32} color={SHOP_MUTED} />}
            title="Todavía no publicaste nada"
            description="Vendé la paleta, las zapatillas o el bolso que ya no usás."
          />
        ) : (
          grouped.map((section) => (
            <View key={section.status} style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>
                {section.title} ({section.rows.length})
              </Text>
              {section.rows.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onPress={() =>
                    router.push({ pathname: '/marketplace/[id]', params: { id: listing.id } } as any)
                  }
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: SHOP_CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: SHOP_IMAGE_BG,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fontFamily.regular,
  },
  price: {
    color: SHOP_LIME,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  meta: {
    color: SHOP_MUTED,
    fontSize: 11.5,
    fontFamily: fontFamily.regular,
  },
  status: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
});
