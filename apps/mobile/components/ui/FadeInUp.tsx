import { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleProp, View, ViewStyle } from 'react-native';
import { useReduceMotion } from '@/lib/reduce-motion';
import { ui } from '@/theme/tokens';

type FadeInUpProps = {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  delay?: number;
};

export function FadeInUp({ children, index = 0, style, delay = 0 }: FadeInUpProps) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: ui.motion.normal,
      delay: delay + index * 60,
      useNativeDriver: true,
    }).start();
  }, [delay, index, progress, reduceMotion]);

  if (reduceMotion) {
    return <View style={style}>{children}</View>;
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export function FadeInView({ children, style, delay = 0 }: Omit<FadeInUpProps, 'index'>) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: ui.motion.normal,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, opacity, reduceMotion]);

  if (reduceMotion) {
    return <View style={style}>{children}</View>;
  }

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

export { FadeInView as FadeIn };
