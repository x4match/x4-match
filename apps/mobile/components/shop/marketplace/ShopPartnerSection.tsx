import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '@/lib/haptics';
import type { ShopPartner, ShopProduct } from '@/lib/shop/marketplace';
import { fontFamily } from '@/theme/tokens';
import { PartnerLogo } from './PartnerLogo';
import { ShopProductCard } from './ShopProductCard';
import { SHOP_LIME, SHOP_MUTED, partnerAccent, withAlpha } from './theme';

const STRIPES = require('../../../assets/figma/matches/tiras.png');
const CARD_WIDTH = 156;
const CARD_GAP = 12;

function productCountLabel(count: number) {
  return `${count} producto${count === 1 ? '' : 's'}`;
}

type ShopPartnerSectionProps = {
  partner: ShopPartner;
  products: ShopProduct[];
  horizontalInset: number;
  onPressProduct: (product: ShopProduct) => void;
  onSeeAll: () => void;
};

/** Catálogo de un partner como carrusel horizontal, con acceso a su vista completa. */
export function ShopPartnerSection({
  partner,
  products,
  horizontalInset,
  onPressProduct,
  onSeeAll,
}: ShopPartnerSectionProps) {
  const offers = products.filter((p) => p.discountPercent > 0).length;

  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver catálogo completo de ${partner.name}`}
        onPress={() => {
          void hapticLight();
          onSeeAll();
        }}
        style={styles.header}
      >
        <PartnerLogo partner={partner} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.partnerName} numberOfLines={1}>
            {partner.name}
          </Text>
          <Text style={styles.partnerMeta} numberOfLines={1}>
            {partner.tagline ? `${partner.tagline} · ` : ''}
            {productCountLabel(products.length)}
            {offers > 0 ? ` · ${offers} en oferta` : ''}
          </Text>
        </View>
        <View style={styles.seeAll}>
          <Text style={styles.seeAllText}>Ver todo</Text>
          <Ionicons name="chevron-forward" size={14} color={SHOP_LIME} />
        </View>
      </Pressable>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        style={{ marginHorizontal: -horizontalInset }}
        contentContainerStyle={{ paddingHorizontal: horizontalInset }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        renderItem={({ item }) => (
          <ShopProductCard product={item} width={CARD_WIDTH} onPress={() => onPressProduct(item)} />
        )}
      />
    </View>
  );
}

type ShopPartnerHeroProps = {
  partner: ShopPartner;
  productCount: number;
  onClose: () => void;
};

/** Cabecera de la tienda de un partner cuando está seleccionado. */
export function ShopPartnerHero({ partner, productCount, onClose }: ShopPartnerHeroProps) {
  const accent = partnerAccent(partner.color);

  return (
    <View style={styles.hero}>
      {partner.bannerUrl ? (
        <Image source={{ uri: partner.bannerUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      <LinearGradient
        colors={
          partner.bannerUrl
            ? ['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']
            : [withAlpha(accent, 0.35), '#111115']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!partner.bannerUrl ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={STRIPES} style={styles.heroStripes} resizeMode="cover" />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver a todos los partners"
        onPress={onClose}
        hitSlop={8}
        style={styles.heroClose}
      >
        <Ionicons name="close" size={16} color="#FFFFFF" />
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PartnerLogo partner={partner} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroEyebrow}>TIENDA PARTNER</Text>
          <Text style={styles.heroName} numberOfLines={1}>
            {partner.name}
          </Text>
          <Text style={styles.heroMeta} numberOfLines={2}>
            {partner.tagline ? `${partner.tagline} · ` : ''}
            {productCountLabel(productCount)}
          </Text>
        </View>
      </View>

      {partner.storeUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Visitar la tienda web de ${partner.name}`}
          onPress={() => {
            void hapticLight();
            void Linking.openURL(partner.storeUrl!);
          }}
          style={styles.heroCta}
        >
          <Ionicons name="storefront" size={14} color="#000" />
          <Text style={styles.heroCtaText}>Visitar tienda web</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  partnerName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  partnerMeta: {
    color: SHOP_MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fontFamily.regular,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 8,
  },
  seeAllText: {
    color: SHOP_LIME,
    fontSize: 13,
    fontFamily: fontFamily.regular,
  },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    padding: 16,
    gap: 14,
    minHeight: 150,
    justifyContent: 'flex-end',
    backgroundColor: '#111115',
  },
  heroStripes: {
    position: 'absolute',
    right: -30,
    top: -10,
    width: 200,
    height: 190,
    opacity: 0.3,
  },
  heroClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heroEyebrow: {
    color: SHOP_LIME,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
    marginTop: 2,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: fontFamily.regular,
  },
  heroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SHOP_LIME,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroCtaText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
});
