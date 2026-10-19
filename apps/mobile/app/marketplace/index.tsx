import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { hapticSelection } from '@/lib/haptics';
import { isPlayer } from '@/lib/roles';
import {
  DEFAULT_SHOP_FILTERS,
  applyShopFilters,
  countSheetFilters,
  type ShopFilters,
  type ShopProduct,
} from '@/lib/shop/marketplace';
import {
  LISTING_CATEGORIES,
  MARKETPLACE_QUERY_KEY,
  fetchMarketplaceListings,
} from '@/lib/shop/player-marketplace';
import { fontFamily } from '@/theme/tokens';
import { Screen, StackHeader, EmptyState, Skeleton, FadeInUp } from '@/components/x4match';
import {
  CategoryChips,
  SHOP_GLASS,
  SHOP_LIME,
  SHOP_MUTED,
  ShopFilterSheet,
  ShopHeroCarousel,
  ShopProductCard,
} from '@/components/shop/marketplace';

const INSET = 16;
const GRID_GAP = 12;
const RECENT_LIMIT = 8;
const CATEGORY_ORDER = LISTING_CATEGORIES.map((c) => c.label);

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', fontFamily: fontFamily.bold }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: SHOP_MUTED, fontSize: 12, fontFamily: fontFamily.regular }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function MarketplaceSkeleton({ width, cardWidth }: { width: number; cardWidth: number }) {
  return (
    <View style={{ gap: 20 }}>
      <Skeleton width={width} height={196} radius={22} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[80, 110, 96].map((w, i) => (
          <Skeleton key={i} width={w} height={36} radius={999} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={cardWidth} height={cardWidth + 90} radius={18} />
        ))}
      </View>
    </View>
  );
}

function SellBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Publicar un producto para vender"
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      style={({ pressed }) => [
        SHOP_GLASS,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderColor: 'rgba(215,255,0,0.35)',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: SHOP_LIME,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="pricetag" size={20} color="#000" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', fontFamily: fontFamily.bold }}>
          ¿Tenés algo para vender?
        </Text>
        <Text style={{ color: SHOP_MUTED, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular }}>
          Publicá tu paleta, zapatillas o lo que ya no uses. Es gratis.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={SHOP_LIME} />
    </Pressable>
  );
}

export default function PlayerMarketplaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canSell = !!user && isPlayer(user.role);
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = windowWidth - INSET * 2;
  const gridCardWidth = Math.floor((contentWidth - GRID_GAP) / 2);

  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_SHOP_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const listingsQuery = useQuery({
    queryKey: MARKETPLACE_QUERY_KEY,
    queryFn: fetchMarketplaceListings,
  });

  const products = useMemo(() => listingsQuery.data?.products ?? [], [listingsQuery.data]);
  const sellers = useMemo(() => listingsQuery.data?.sellers ?? new Map(), [listingsQuery.data]);

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    return CATEGORY_ORDER.filter((label) => present.has(label));
  }, [products]);

  const filtered = useMemo(() => applyShopFilters(products, filters), [products, filters]);
  const recent = useMemo(() => products.slice(0, RECENT_LIMIT), [products]);

  const sheetFilterCount = countSheetFilters(filters);
  const hasNarrowing =
    filters.query.trim().length > 0 || filters.category != null || sheetFilterCount > 0;

  const openListing = useCallback(
    (product: ShopProduct) => {
      router.push({ pathname: '/marketplace/[id]', params: { id: product.id } } as any);
    },
    [router],
  );

  const openSell = useCallback(() => router.push('/marketplace/sell' as any), [router]);

  const clearAll = useCallback(() => {
    void hapticSelection();
    setFilters(DEFAULT_SHOP_FILTERS);
  }, []);

  const resultLabel = `${filtered.length} producto${filtered.length === 1 ? '' : 's'}`;

  return (
    <Screen>
      <StackHeader
        title="Marketplace"
        rightAction={
          canSell ? (
            <Pressable
              onPress={() => router.push('/marketplace/mine' as any)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Mis publicaciones"
            >
              <Ionicons name="storefront-outline" size={22} color="#FFFFFF" />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: INSET, paddingBottom: insets.bottom + 96, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={listingsQuery.isRefetching}
            onRefresh={() => listingsQuery.refetch()}
            tintColor={SHOP_LIME}
          />
        }
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View
            style={[
              SHOP_GLASS,
              { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 48 },
            ]}
          >
            <Ionicons name="search" size={18} color={SHOP_MUTED} />
            <TextInput
              value={filters.query}
              onChangeText={(query) => setFilters((prev) => ({ ...prev, query }))}
              placeholder="Buscar paletas, zapatillas..."
              placeholderTextColor={SHOP_MUTED}
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 10,
                fontSize: 14,
                fontFamily: fontFamily.regular,
                color: '#FFFFFF',
              }}
            />
            {filters.query.length > 0 ? (
              <Pressable
                onPress={() => setFilters((prev) => ({ ...prev, query: '' }))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Limpiar búsqueda"
              >
                <Ionicons name="close-circle" size={18} color={SHOP_MUTED} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filtros${sheetFilterCount ? `, ${sheetFilterCount} activos` : ''}`}
            onPress={() => {
              void hapticSelection();
              setSheetOpen(true);
            }}
            style={[
              SHOP_GLASS,
              { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
              sheetFilterCount > 0 ? { borderColor: 'rgba(215,255,0,0.55)' } : null,
            ]}
          >
            <Ionicons name="options-outline" size={20} color={sheetFilterCount > 0 ? SHOP_LIME : '#FFFFFF'} />
            {sheetFilterCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: SHOP_LIME,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: '#000', fontSize: 10, fontWeight: '800', fontFamily: fontFamily.bold }}>
                  {sheetFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {canSell && !hasNarrowing ? <SellBanner onPress={openSell} /> : null}

        {listingsQuery.isLoading ? (
          <MarketplaceSkeleton width={contentWidth} cardWidth={gridCardWidth} />
        ) : listingsQuery.isError ? (
          <EmptyState
            icon={<Ionicons name="cloud-offline-outline" size={32} color={SHOP_MUTED} />}
            title="No pudimos cargar el marketplace"
            description="Deslizá hacia abajo para reintentar."
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="pricetags-outline" size={32} color={SHOP_MUTED} />}
            title="Todavía no hay publicaciones"
            description={
              canSell
                ? 'Sé el primero en publicar algo para vender.'
                : 'Pronto vas a ver acá lo que venden los jugadores.'
            }
          />
        ) : (
          <>
            {!hasNarrowing && recent.length > 0 ? (
              <FadeInUp index={0} style={{ gap: 12 }}>
                <SectionTitle title="Recién publicados" subtitle="Lo último que subieron los jugadores" />
                <ShopHeroCarousel
                  products={recent}
                  partners={sellers}
                  width={contentWidth}
                  onPressProduct={openListing}
                  badgeFor={(p) => (p.isNew ? 'NUEVO' : p.category.toUpperCase())}
                  ctaLabel="Ver"
                />
              </FadeInUp>
            ) : null}

            <CategoryChips
              categories={categories}
              selected={filters.category}
              onSelect={(category) => setFilters((prev) => ({ ...prev, category }))}
              inset={INSET}
            />

            {hasNarrowing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: SHOP_MUTED, fontSize: 13, fontFamily: fontFamily.regular }}>
                  {resultLabel}
                </Text>
                <Pressable onPress={clearAll} hitSlop={8} accessibilityRole="button">
                  <Text style={{ color: SHOP_LIME, fontSize: 13, fontFamily: fontFamily.regular }}>
                    Limpiar filtros
                  </Text>
                </Pressable>
              </View>
            ) : (
              <SectionTitle title="Todos los productos" subtitle={resultLabel} />
            )}

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="search-outline" size={32} color={SHOP_MUTED} />}
                title="Sin resultados"
                description="Probá con otra búsqueda o ajustá los filtros."
              />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                {filtered.map((product, i) => (
                  <FadeInUp key={product.id} index={Math.min(i, 8)}>
                    <ShopProductCard
                      product={product}
                      partner={sellers.get(product.partnerId)}
                      width={gridCardWidth}
                      onPress={() => openListing(product)}
                    />
                  </FadeInUp>
                ))}
              </View>
            )}

            <Text
              style={{
                color: SHOP_MUTED,
                fontSize: 11.5,
                textAlign: 'center',
                marginTop: 4,
                lineHeight: 16,
                fontFamily: fontFamily.regular,
              }}
            >
              x4 Match no interviene en las ventas entre jugadores. Coordiná el pago y la entrega por mensaje y
              revisá el producto antes de pagar.
            </Text>
          </>
        )}
      </ScrollView>

      {canSell ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vender un producto"
          onPress={() => {
            void hapticSelection();
            openSell();
          }}
          style={({ pressed }) => ({
            position: 'absolute',
            right: INSET,
            bottom: insets.bottom + 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: SHOP_LIME,
            borderRadius: 999,
            paddingHorizontal: 18,
            paddingVertical: 13,
            shadowColor: SHOP_LIME,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Ionicons name="add" size={20} color="#000" />
          <Text style={{ color: '#000', fontSize: 14, fontWeight: '800', fontFamily: fontFamily.bold }}>
            Vender
          </Text>
        </Pressable>
      ) : null}

      <ShopFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        products={products}
        onApply={setFilters}
        newToggle={{ label: 'Solo nuevos', hint: 'Productos sin uso' }}
        hideOffersToggle
        hideStockToggle
        hiddenSorts={['discount']}
      />
    </Screen>
  );
}
