import { useEffect, useRef } from 'react';
import { Animated, StyleProp, View, ViewStyle } from 'react-native';
import { useReduceMotion } from '@/lib/reduce-motion';
import { ui } from '@/theme/tokens';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%', height = 16, radius = ui.radius.sm, style }: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: ui.colors.surface3,
          overflow: 'hidden',
        },
        { opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: ui.colors.surface1,
          borderRadius: ui.radius.lg,
          borderWidth: 1,
          borderColor: ui.colors.border,
          padding: ui.spacing.lg,
          gap: ui.spacing.sm,
        },
        style,
      ]}
    >
      <Skeleton width="55%" height={18} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="100%" height={48} radius={ui.radius.sm} />
    </View>
  );
}
