import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useReduceMotion } from '@/lib/reduce-motion';
import { fontFamily } from '@/theme/tokens';

const BRAND = '#E6FA0A';
const BG = '#000000';
const VIEW = 512;
const BALL_R_VB = 28;

/** Centro final de la pelota en el logo (viewBox 512). */
const BALL_REST = { x: 426, y: 95 };

/** Keyframes del pique alineados al arco del logo. */
const KEYFRAMES = [
  { t: 0, x: 70, y: 238 },
  { t: 0.22, x: 118, y: 128 },
  { t: 0.38, x: 168, y: 175 },
  { t: 0.5, x: 220, y: 222 },
  { t: 0.72, x: 310, y: 108 },
  { t: 1, x: BALL_REST.x, y: BALL_REST.y },
] as const;

const TRAJECTORY_PATH =
  'M63.57 237.29C82.71 148.31 149.37 86.64 212.98 185.64L229.84 226.21C248.97 166.5 295.17 102.28 363.52 98.84C368.65 98.58 376.86 97.71 380.89 100.98C303.54 110.99 253.06 182.35 229.83 251.11L210.93 207.04C159.3 110.34 90.3 154.93 64.94 240.05C63.86 240.96 63.4 240.03 63.55 237.28L63.57 237.29Z';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function samplePath(progress: number) {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  let i = 0;
  while (i < KEYFRAMES.length - 2 && KEYFRAMES[i + 1].t < p) i += 1;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const local = (p - a.t) / (b.t - a.t || 1);
  const eased = local * local * (3 - 2 * local);
  return {
    x: a.x + (b.x - a.x) * eased,
    y: a.y + (b.y - a.y) * eased,
  };
}

type AnimatedSplashProps = {
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const markSize = Math.min(width * 0.72, 320);
  const scale = markSize / VIEW;
  const ballSize = BALL_R_VB * 2 * scale;

  const progress = useSharedValue(0);
  const trail = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    const finish = () => onFinish();

    if (reduceMotion) {
      progress.value = 1;
      trail.value = 1;
      textOpacity.value = 1;
      screenOpacity.value = withDelay(
        450,
        withTiming(0, { duration: 280 }, (done) => {
          if (done) runOnJS(finish)();
        }),
      );
      return () => cancelAnimation(screenOpacity);
    }

    trail.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });

    progress.value = withSequence(
      withTiming(0.22, { duration: 320, easing: Easing.out(Easing.quad) }),
      withTiming(0.5, { duration: 300, easing: Easing.in(Easing.quad) }),
      withTiming(0.85, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
    );

    textOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );

    screenOpacity.value = withDelay(
      1750,
      withTiming(0, { duration: 320, easing: Easing.inOut(Easing.quad) }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );

    return () => {
      cancelAnimation(progress);
      cancelAnimation(trail);
      cancelAnimation(textOpacity);
      cancelAnimation(screenOpacity);
    };
  }, [onFinish, progress, reduceMotion, screenOpacity, textOpacity, trail]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [
      {
        translateY: interpolate(textOpacity.value, [0, 1], [10, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const ballStyle = useAnimatedStyle(() => {
    const { x, y } = samplePath(progress.value);
    return {
      transform: [
        { translateX: x * scale - ballSize / 2 },
        { translateY: y * scale - ballSize / 2 },
      ],
    };
  });

  const trailProps = useAnimatedProps(() => ({
    opacity: trail.value,
  }));

  return (
    <Animated.View style={[styles.root, screenStyle]} pointerEvents="none">
      <View style={[styles.mark, { width: markSize }]}>
        <View style={{ width: markSize, height: markSize }}>
          <Svg width={markSize} height={markSize} viewBox={`0 0 ${VIEW} ${VIEW}`}>
            <AnimatedPath animatedProps={trailProps} d={TRAJECTORY_PATH} fill={BRAND} />
          </Svg>

          <Animated.View style={[styles.ball, { width: ballSize, height: ballSize }, ballStyle]}>
            <Svg width={ballSize} height={ballSize} viewBox="0 0 60 60">
              <Circle cx="30" cy="30" r="28" fill={BRAND} />
              <Path
                d="M18 14C26 22 26 38 18 46"
                stroke="#111"
                strokeWidth="3.2"
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M42 14C34 22 34 38 42 46"
                stroke="#111"
                strokeWidth="3.2"
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        </View>

        <Animated.View style={[styles.wordmark, textStyle]}>
          <Text style={styles.x4}>X4</Text>
          <Text style={styles.match}>MATCH</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  mark: {
    alignItems: 'center',
  },
  ball: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  wordmark: {
    marginTop: -36,
    alignItems: 'center',
  },
  x4: {
    color: '#FFFFFF',
    fontFamily: fontFamily.extrabold,
    fontSize: 56,
    letterSpacing: 1,
    lineHeight: 58,
  },
  match: {
    color: BRAND,
    fontFamily: fontFamily.bold,
    fontSize: 28,
    letterSpacing: 4,
    marginTop: 2,
  },
});
