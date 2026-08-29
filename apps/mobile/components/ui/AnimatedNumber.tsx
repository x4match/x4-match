import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TextStyle } from 'react-native';
import { useReduceMotion } from '@/lib/reduce-motion';
import { ui } from '@/theme/tokens';

type AnimatedNumberProps = {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  style?: TextStyle;
  duration?: number;
};

export function AnimatedNumber({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  style,
  duration = ui.motion.slow,
}: AnimatedNumberProps) {
  const reduceMotion = useReduceMotion();
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      animatedValue.setValue(value);
      return;
    }
    const id = animatedValue.addListener(({ value: current }) => {
      setDisplay(current);
    });
    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animatedValue.removeListener(id);
  }, [animatedValue, duration, reduceMotion, value]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();

  return (
    <Text style={[ui.typography.stat, { color: ui.colors.textPrimary }, style]}>
      {prefix}
      {formatted}
      {suffix}
    </Text>
  );
}
