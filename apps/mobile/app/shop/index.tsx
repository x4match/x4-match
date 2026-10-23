import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelection } from '@/lib/haptics';
import {
  DEFAULT_SHOP_FILTERS,
  applyShopFilters,
  countSheetFilters,
  fetchShopCatalog,
  listCategories,
  pickHighlights,
  type ShopFilters,
  type ShopPartner,
  type ShopProduct,
} from '@/lib/shop/marketplace';
import { fontFamily } from '@/theme/tokens';
import { Screen, StackHeader, EmptyState, Skeleton, FadeInUp } from '@/components/x4match';
import {
  CategoryChips,
  PartnerChips,
  SHOP_GLASS,
  SHOP_LIME,
  SHOP_MUTED,
  ShopFilterSheet,
  ShopHeroCarousel,
  ShopPartnerHero,
  ShopPartnerSection,
  ShopProductCard,
} from '@/components/shop/marketplace';

const INSET = 16;
const GRID_GAP = 12;

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

function ShopSkeleton({ width }: { width: number }) {
  const cardWidth = 156;
  return (
    <View style={{ gap: 20 }}>
      <Skeleton width={width} height={196} radius={22} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[80, 110, 96].map((w, i) => (
          <Skeleton key={i} width={w} height={36} radius={999} />
        ))}
      </View>
      {[0, 1].map((row) => (
        <View key={row} style={{ gap: 12 }}>
          <Skeleton width={180} height={20} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[0, 1].map((i) => (
              <Skeleton key={i} width={cardWidth} height={cardWidth + 90} radius={18} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PlatformShopScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = windowWidth - INSET * 2;
  const gridCardWidth = Math.floor((contentWidth - GRID_GAP) / 2);

  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_SHOP_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ['platform-shop-catalog'],
    queryFn: fetchShopCatalog,
  });

  const products = useMemo(() => catalogQuery.data?.products ?? [], [catalogQuery.data]);
  const partners = useMemo(() => catalogQuery.data?.partners ?? [], [catalogQuery.data]);
  const partnersById = useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners]);

  const partnerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.partnerId, (counts.get(p.partnerId) ?? 0) + 1);
    return counts;
  }, [products]);

  const categories = useMemo(
    () =>
      listCategories(
        filters.partnerId ? products.filter((p) => p.partnerId === filters.partnerId) : products,
      ),
    [products, filters.partnerId],
  );

  const filtered = useMemo(() => applyShopFilters(products, filters), [products, filters]);

  const sections = useMemo(() => {
    const byPartner = new Map<string, ShopProduct[]>();
    for (const p of filtered) {
      const list = byPartner.get(p.partnerId) ?? [];
      list.push(p);
      byPartner.set(p.partnerId, list);
    }
    return partners
      .filter((partner) => byPartner.has(partner.id))
      .map((partner) => ({ partner, products: byPartner.get(partner.id)! }));
  }, [filtered, partners]);

  const highlights = useMemo(() => pickHighlights(products), [products]);

  const sheetFilterCount = countSheetFilters(filters);
  const hasNarrowing =
    filters.query.trim().length > 0 || filters.category != null || sheetFilterCount > 0;
  const selectedPartner: ShopPartner | undefined = filters.partnerId
    ? partnersById.get(filters.partnerId)
    : undefined;

  const openProduct = useCallback((product: ShopProduct) => {
    if (product.productUrl) void Linking.openURL(product.productUrl);
  }, []);

  const selectPartner = useCallback((partnerId: string | null) => {
    setFilters((prev) => ({ ...prev, partnerId, category: null }));
  }, []);

  const clearAll = useCallback(() => {
    void hapticSelection();
    setFilters((prev) => ({ ...DEFAULT_SHOP_FILTERS, partnerId: prev.partnerId }));
  }, []);

  const resultLabel = `${filtered.length} producto${filtered.length === 1 ? '' : 's'}`;

  return (
    <Screen>
      <StackHeader title="Shop x4" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: INSET, paddingBottom: insets.bottom + 32, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={catalogQuery.isRefetching}
            onRefresh={() => catalogQuery.refetch()}
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
              placeholder={selectedPartner ? `Buscar en ${selectedPartner.name}...` : 'Buscar productos...'}
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
              {
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
              },
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

        {catalogQuery.isLoading ? (
          <ShopSkeleton width={contentWidth} />
        ) : catalogQuery.isError ? (
          <EmptyState
            icon={<Ionicons name="cloud-offline-outline" size={32} color={SHOP_MUTED} />}
            title="No pudimos cargar el shop"
            description="Deslizá hacia abajo para reintentar."
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="bag-outline" size={32} color={SHOP_MUTED} />}
            title="Sin productos"
            description="Pronto vas a ver ofertas de nuestros partners acá."
          />
        ) : (
          <>
            {!selectedPartner && !hasNarrowing && highlights.length > 0 ? (
              <FadeInUp index={0} style={{ gap: 12 }}>
                <SectionTitle title="Destacados" subtitle="Lo mejor de nuestros partners" />
                <ShopHeroCarousel
                  products={highlights}
                  partners={partnersById}
                  width={contentWidth}
                  onPressProduct={openProduct}
                />
              </FadeInUp>
            ) : null}

            {partners.length > 1 ? (
              <FadeInUp index={1} style={{ gap: 10 }}>
                <SectionTitle title="Partners" />
                <PartnerChips
                  partners={partners}
                  counts={partnerCounts}
                  selectedId={filters.partnerId}
                  onSelect={selectPartner}
                  inset={INSET}
                />
              </FadeInUp>
            ) : null}

            {selectedPartner ? (
              <ShopPartnerHero
                partner={selectedPartner}
                productCount={partnerCounts.get(selectedPartner.id) ?? 0}
                onClose={() => selectPartner(null)}
              />
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
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="search-outline" size={32} color={SHOP_MUTED} />}
                title="Sin resultados"
                description="Probá con otra búsqueda o ajustá los filtros."
              />
            ) : selectedPartner ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                {filtered.map((product, i) => (
                  <FadeInUp key={product.id} index={Math.min(i, 8)}>
                    <ShopProductCard
                      product={product}
                      width={gridCardWidth}
                      onPress={() => openProduct(product)}
                    />
                  </FadeInUp>
                ))}
              </View>
            ) : (
              sections.map(({ partner, products: partnerProducts }, i) => (
                <FadeInUp key={partner.id} index={i + 2}>
                  <ShopPartnerSection
                    partner={partner}
                    products={partnerProducts}
                    horizontalInset={INSET}
                    onPressProduct={openProduct}
                    onSeeAll={() => selectPartner(partner.id)}
                  />
                </FadeInUp>
              ))
            )}

            <Text
              style={{
                color: SHOP_MUTED,
                fontSize: 11.5,
                textAlign: 'center',
                marginTop: 4,
                fontFamily: fontFamily.regular,
              }}
            >
              Al tocar un producto vas a la tienda web del partner para completar la compra.
            </Text>
          </>
        )}
      </ScrollView>

      <ShopFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        products={products}
        onApply={setFilters}
      />
    </Screen>
  );
}
