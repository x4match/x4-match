import { useEffect } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/ui';
import { useReduceMotion } from '@/lib/reduce-motion';
import { fontFamily } from '@/theme/tokens';

const STRIPES = require('../../assets/figma/matches/tiras.png');

const LIME = '#D7FF00';
const SHIMMER_WIDTH = 90;

type ShopPromoBannerProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ShopPromoBanner({ onPress, style }: ShopPromoBannerProps) {
  const reduceMotion = useReduceMotion();
  const bannerWidth = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(shimmer);
      cancelAnimation(float);
      cancelAnimation(pulse);
      shimmer.value = 0;
      float.value = 0;
      pulse.value = 0;
      return;
    }
    shimmer.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(1400, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) })),
      ),
      -1,
    );
    float.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(shimmer);
      cancelAnimation(float);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, shimmer, float, pulse]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: bannerWidth.value > 0 ? 1 : 0,
    transform: [
      { translateX: -SHIMMER_WIDTH * 2 + shimmer.value * (bannerWidth.value + SHIMMER_WIDTH * 3) },
      { rotate: '18deg' },
    ],
  }));

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 + float.value * 8 }, { rotate: '-8deg' }],
  }));

  const floatAltStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 3 - float.value * 6 }, { rotate: '12deg' }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.04 }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pulse.value * 3 }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    bannerWidth.value = event.nativeEvent.layout.width;
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Abrir Shop x4: merch oficial y productos de patrocinadores"
      onPress={onPress}
      style={style}
    >
      <View style={styles.shadow}>
        <LinearGradient
          colors={['#3A4700', '#161A06', '#0B0B0E']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
          onLayout={handleLayout}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={styles.glowMain} />
            <View style={styles.glowSecondary} />
            <Image
              source={STRIPES}
              style={styles.stripes}
              resizeMode="cover"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Animated.View style={[styles.shimmer, shimmerStyle]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>
              Shop <Text style={{ color: LIME }}>x4</Text>
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Merch oficial y productos de patrocinadores. ¡Canjeá tus puntos!
            </Text>

            <Animated.View style={[styles.cta, ctaStyle]}>
              <Text style={styles.ctaText}>Ver tienda</Text>
              <Animated.View style={arrowStyle}>
                <Ionicons name="arrow-forward" size={15} color="#000" />
              </Animated.View>
            </Animated.View>
          </View>

          <View pointerEvents="none" style={styles.productCluster}>
            <Animated.View style={[styles.tileSmall, styles.tileTop, floatAltStyle]}>
              <Ionicons name="shirt" size={20} color={LIME} />
            </Animated.View>
            <Animated.View style={[styles.tileMain, floatStyle]}>
              <LinearGradient
                colors={[LIME, '#A8C800']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tileMainInner}
              >
                <Ionicons name="bag-handle" size={38} color="#000" />
              </LinearGradient>
            </Animated.View>
            <Animated.View style={[styles.tileSmall, styles.tileBottom, floatAltStyle]}>
              <Ionicons name="tennisball" size={18} color={LIME} />
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    shadowColor: LIME,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.4)',
    overflow: 'hidden',
    minHeight: 164,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: 8,
  },
  glowMain: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -70,
    top: -90,
    backgroundColor: 'rgba(215, 255, 0, 0.16)',
  },
  glowSecondary: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    left: -60,
    bottom: -90,
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
  },
  stripes: {
    position: 'absolute',
    right: -30,
    top: -10,
    bottom: -10,
    width: 200,
    height: 190,
    opacity: 0.35,
  },
  shimmer: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: SHIMMER_WIDTH,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LIME,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eyebrowText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: fontFamily.bold,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: fontFamily.bold,
    marginTop: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fontFamily.regular,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: LIME,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ctaText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  productCluster: {
    width: 118,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMain: {
    width: 76,
    height: 76,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tileMainInner: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSmall: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 17, 21, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTop: {
    top: 4,
    right: 6,
  },
  tileBottom: {
    bottom: 6,
    left: 4,
  },
});
