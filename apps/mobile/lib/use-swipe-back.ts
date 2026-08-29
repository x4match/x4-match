import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';
import { useRouter } from 'expo-router';

const EDGE_WIDTH = 28;
const SWIPE_THRESHOLD = 72;

export function useSwipeBack(enabled = true) {
  const router = useRouter();
  const startX = useRef(0);
  const canGoBack = router.canGoBack();

  return useMemo(() => {
    if (!enabled || !canGoBack) return {};

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => {
        startX.current = evt.nativeEvent.pageX;
        return evt.nativeEvent.pageX <= EDGE_WIDTH;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          startX.current <= EDGE_WIDTH &&
          gestureState.dx > 12 &&
          Math.abs(gestureState.dy) < Math.abs(gestureState.dx) * 1.5
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= SWIPE_THRESHOLD || gestureState.vx > 0.5) {
          router.back();
        }
      },
    });

    return panResponder.panHandlers;
  }, [enabled, canGoBack, router]);
}
