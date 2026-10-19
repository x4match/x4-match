import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '@/lib/format';
import { hapticLight } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/reduce-motion';
import type { ShopPartner, ShopProduct } from '@/lib/shop/marketplace';
import { fontFamily } from '@/theme/tokens';
import { PartnerLogo } from './PartnerLogo';
import { SHOP_IMAGE_BG, SHOP_LIME, SHOP_MUTED, partnerAccent, withAlpha } from './theme';

const STRIPES = require('../../../assets/figma/matches/tiras.png');
const AUTOPLAY_MS = 4500;
const GAP = 12;
const HEIGHT = 196;

type ShopHeroCarouselProps = {
  products: ShopProduct[];
  partners: Map<string, ShopPartner>;
  width: number;
  onPressProduct: (product: ShopProduct) => void;
  badgeFor?: (product: ShopProduct) => string;
  ctaLabel?: string;
};

function heroBadge(product: ShopProduct): string {
  if (product.discountPercent > 0) return `${product.discountPercent}% OFF`;
  if (product.isNew) return 'NUEVO';
  if (product.featured) return 'DESTACADO';
  return 'RECOMENDADO';
}

function HeroSlide({
  product,
  partner,
  width,
  onPress,
  badge,
  ctaLabel,
}: {
  product: ShopProduct;
  partner?: ShopPartner;
  width: number;
  onPress: () => void;
  badge: string;
  ctaLabel: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const accent = partnerAccent(partner?.color);
  const imageSize = Math.round(HEIGHT - 36);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Destacado: ${product.name}, ${formatCurrency(product.price, product.currency)}`}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      style={({ pressed }) => ({ width, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <LinearGradient
        colors={[withAlpha(accent, 0.32), '#141418', '#0B0B0E']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.slide}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.glow, { backgroundColor: withAlpha(accent, 0.18) }]} />
          <Image source={STRIPES} style={styles.stripes} resizeMode="cover" />
        </View>

        <View style={styles.info}>
          <View style={styles.partnerRow}>
            {partner ? <PartnerLogo partner={partner} size={22} /> : null}
            <Text style={styles.partnerName} numberOfLines={1}>
              {partner?.name ?? 'x4 Partners'}
            </Text>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {product.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={styles.price}>{formatCurrency(product.price, product.currency)}</Text>
            {product.compareAtPrice ? (
              <Text style={styles.compare}>{formatCurrency(product.compareAtPrice, product.currency)}</Text>
            ) : null}
          </View>

          <View style={styles.cta}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={13} color="#000" />
          </View>
        </View>

        <View style={[styles.imageFrame, { width: imageSize * 0.82, height: imageSize }]}>
          {product.photoUrl && !imageFailed ? (
            <Image
              source={{ uri: product.photoUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Ionicons name="bag-handle" size={48} color={accent} />
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function ShopHeroCarousel({
  products,
  partners,
  width,
  onPressProduct,
  badgeFor = heroBadge,
  ctaLabel = 'Comprar',
}: ShopHeroCarouselProps) {
  const reduceMotion = useReduceMotion();
  const listRef = useRef<FlatList<ShopProduct>>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const interval = width + GAP;

  useEffect(() => {
    if (index >= products.length) setIndex(0);
  }, [products.length, index]);

  useEffect(() => {
    if (reduceMotion || dragging || products.length < 2) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % products.length;
      listRef.current?.scrollToOffset({ offset: next * interval, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, dragging, reduceMotion, products.length, interval]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / interval);
      setIndex(Math.max(0, Math.min(products.length - 1, next)));
      setDragging(false);
    },
    [interval, products.length],
  );

  if (!products.length) return null;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={products}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: interval, offset: interval * i, index: i })}
        renderItem={({ item, index: i }) => (
          <View style={{ marginRight: i === products.length - 1 ? 0 : GAP }}>
            <HeroSlide
              product={item}
              partner={partners.get(item.partnerId)}
              width={width}
              onPress={() => onPressProduct(item)}
              badge={badgeFor(item)}
              ctaLabel={ctaLabel}
            />
          </View>
        )}
      />
      {products.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {products.map((p, i) => (
            <View
              key={p.id}
              style={[styles.dot, i === index ? styles.dotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    height: HEIGHT,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(215,255,0,0.22)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 14,
    gap: 10,
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -60,
    top: -70,
  },
  stripes: {
    position: 'absolute',
    right: -30,
    top: -10,
    width: 200,
    height: 220,
    opacity: 0.3,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerName: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: SHOP_LIME,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: fontFamily.bold,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  price: {
    color: SHOP_LIME,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  compare: {
    color: SHOP_MUTED,
    fontSize: 12,
    textDecorationLine: 'line-through',
    fontFamily: fontFamily.regular,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SHOP_LIME,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  ctaText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  imageFrame: {
    borderRadius: 16,
    backgroundColor: SHOP_IMAGE_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 18,
    backgroundColor: SHOP_LIME,
  },
});
