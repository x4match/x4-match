import { ReactNode, useCallback, useEffect } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/lib/reduce-motion';

const LIME = '#D7FF00';
const SHEET_BG = '#111115';
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

type DraggableSheetProps = {
  children: ReactNode;
  /** Se llama cuando termina la animación de cierre. */
  onClose: () => void;
  /** Acciones a la derecha del handle (ej. configuración). */
  headerRight?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Fondo decorativo fijo detrás del contenido. */
  background?: ReactNode;
};

/**
 * Hoja modal a pantalla casi completa: entra desde abajo, se cierra
 * arrastrando hacia abajo (desde el handle o con el scroll arriba de todo),
 * tocando el fondo o con el botón atrás de Android.
 */
export function DraggableSheet({
  children,
  onClose,
  headerRight,
  contentContainerStyle,
  background,
}: DraggableSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const translateY = useSharedValue(screenHeight);
  const scrollY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragStart = useSharedValue(0);
  const closing = useSharedValue(false);

  useEffect(() => {
    translateY.value = reduceMotion
      ? 0
      : withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, translateY]);

  const close = useCallback(() => {
    if (closing.value) return;
    closing.value = true;
    translateY.value = withTiming(
      screenHeight,
      { duration: reduceMotion ? 0 : 220, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  }, [closing, onClose, reduceMotion, screenHeight, translateY]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const settle = (velocityY: number) => {
    'worklet';
    if (translateY.value > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) {
      runOnJS(close)();
    } else {
      translateY.value = withSpring(0, { damping: 22, stiffness: 240 });
    }
  };

  const handlePan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => settle(e.velocityY));

  const scrollGesture = Gesture.Native();
  const contentPan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onStart(() => {
      dragging.value = false;
    })
    .onUpdate((e) => {
      if (!dragging.value) {
        if (scrollY.value <= 0 && e.translationY > 0) {
          dragging.value = true;
          dragStart.value = e.translationY;
        } else {
          return;
        }
      }
      translateY.value = Math.max(0, e.translationY - dragStart.value);
    })
    .onEnd((e) => {
      if (!dragging.value) return;
      dragging.value = false;
      settle(e.velocityY);
    });

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, screenHeight], [1, 0]),
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
      </Animated.View>

      <Animated.View style={[styles.sheet, { marginTop: insets.top + 12 }, sheetStyle]}>
        {background ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {background}
          </View>
        ) : null}

        <GestureDetector gesture={handlePan}>
          <View style={styles.handleZone}>
            <View style={styles.handle} />
            {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
          </View>
        </GestureDetector>

        <GestureDetector gesture={Gesture.Simultaneous(contentPan, scrollGesture)}>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              { paddingBottom: Math.max(insets.bottom, 16) + 16 },
              contentContainerStyle,
            ]}
          >
            {children}
          </Animated.ScrollView>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    flex: 1,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  handleZone: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: '36%',
    maxWidth: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: LIME,
  },
  headerRight: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
