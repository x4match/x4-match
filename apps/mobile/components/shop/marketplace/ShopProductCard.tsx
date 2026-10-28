import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@/lib/format';
import { hapticLight } from '@/lib/haptics';
import type { ShopPartner, ShopProduct } from '@/lib/shop/marketplace';
import { fontFamily } from '@/theme/tokens';
import { SHOP_CARD_BG, SHOP_IMAGE_BG, SHOP_LIME, SHOP_MUTED } from './theme';

type ShopProductCardProps = {
  product: ShopProduct;
  partner?: ShopPartner;
  width: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

function fallbackIcon(category: string): keyof typeof Ionicons.glyphMap {
  const c = category.toLowerCase();
  if (c.includes('indument') || c.includes('remer') || c.includes('ropa')) return 'shirt-outline';
  if (c.includes('palet')) return 'tennisball-outline';
  if (c.includes('calzad') || c.includes('zapat')) return 'footsteps-outline';
  return 'bag-handle-outline';
}

export function ShopProductCard({ product, partner, width, onPress, style }: ShopProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(product.photoUrl) && !imageFailed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.featured ? 'Destacado: ' : ''}${product.name}${partner ? ` de ${partner.name}` : ''}, ${formatCurrency(product.price, product.currency)}${
        !product.inStock ? ', sin stock' : product.stockLeft != null ? `, quedan ${product.stockLeft}` : ''
      }`}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        product.featured && { borderColor: partner?.color || SHOP_LIME, borderWidth: 1.5 },
        { width, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      <View style={[styles.imageBox, { height: width }]}>
        {showImage ? (
          <Image
            source={{ uri: product.photoUrl! }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Ionicons name={fallbackIcon(product.category)} size={Math.round(width * 0.3)} color="#3A3A44" />
        )}

        <View style={styles.badges}>
          {product.featured ? (
            <View style={[styles.badge, styles.badgeRow, { backgroundColor: partner?.color || SHOP_LIME }]}>
              <Ionicons name="star" size={9} color="#000" />
              <Text style={[styles.badgeText, { color: '#000' }]}>DESTACADO</Text>
            </View>
          ) : null}
          {product.discountPercent > 0 ? (
            <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
              <Text style={[styles.badgeText, { color: '#FFF' }]}>-{product.discountPercent}%</Text>
            </View>
          ) : null}
          {product.isNew ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
              <Text style={[styles.badgeText, { color: '#000' }]}>NUEVO</Text>
            </View>
          ) : null}
        </View>

        {product.inStock && product.stockLeft != null ? (
          <View style={[styles.badge, styles.lowStockBadge]}>
            <Text style={[styles.badgeText, { color: '#000' }]}>
              {product.stockLeft === 1 ? '¡ÚLTIMA UNIDAD!' : `¡QUEDAN ${product.stockLeft}!`}
            </Text>
          </View>
        ) : null}

        {!product.inStock ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>SIN STOCK</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {partner ? `${partner.name} · ${product.category}` : product.category}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {product.compareAtPrice ? (
              <Text style={styles.compare} numberOfLines={1}>
                {formatCurrency(product.compareAtPrice, product.currency)}
              </Text>
            ) : null}
            <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatCurrency(product.price, product.currency)}
            </Text>
          </View>
          <View style={styles.goButton}>
            <Ionicons name="arrow-forward" size={14} color="#000" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SHOP_CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  imageBox: {
    width: '100%',
    backgroundColor: SHOP_IMAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lowStockBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: fontFamily.bold,
  },
  soldOut: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: fontFamily.bold,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  body: {
    padding: 10,
    gap: 4,
  },
  eyebrow: {
    color: SHOP_MUTED,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fontFamily.regular,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    minHeight: 36,
    fontFamily: fontFamily.regular,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 2,
  },
  compare: {
    color: SHOP_MUTED,
    fontSize: 11,
    textDecorationLine: 'line-through',
    fontFamily: fontFamily.regular,
  },
  price: {
    color: SHOP_LIME,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  goButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SHOP_LIME,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
