import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { hapticLight } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/reduce-motion';
import { ui } from '@/theme/tokens';

type PressableScaleProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scale?: number;
  haptic?: boolean;
};

export function PressableScale({
  children,
  style,
  scale = ui.motion.pressScale,
  haptic = true,
  disabled,
  onPress,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(disabled ? 0.55 : 1)).current;

  useEffect(() => {
    Animated.timing(opacityValue, {
      toValue: disabled ? 0.55 : 1,
      duration: reduceMotion ? 0 : 120,
      useNativeDriver: true,
    }).start();
  }, [disabled, opacityValue, reduceMotion]);

  const handlePress = useCallback(
    (event: any) => {
      if (haptic && !disabled) void hapticLight();
      onPress?.(event);
    },
    [disabled, haptic, onPress],
  );

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    if (reduceMotion) {
      scaleValue.setValue(scale);
      return;
    }
    Animated.spring(scaleValue, {
      toValue: scale,
      useNativeDriver: true,
      damping: ui.motion.spring.damping,
      stiffness: ui.motion.spring.stiffness,
      mass: ui.motion.spring.mass,
    }).start();
  }, [disabled, reduceMotion, scale, scaleValue]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion) {
      scaleValue.setValue(1);
      return;
    }
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      damping: ui.motion.spring.damping,
      stiffness: ui.motion.spring.stiffness,
      mass: ui.motion.spring.mass,
    }).start();
  }, [reduceMotion, scaleValue]);

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleValue }], opacity: opacityValue }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
