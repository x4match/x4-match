import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Animated,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { needsPlayerOnboarding } from '@/lib/auth/onboarding';
import { hapticSelection } from '@/lib/haptics';
import { hasSeenScreenTour, markScreenTourSeen } from '@/lib/tour';
import { fontFamily } from '@/theme/tokens';

const LIME = '#D7FF00';
const MUTED = '#8E8E9F';
const OVERLAY = 'rgba(0,0,0,0.78)';
const HOLE_PADDING = 6;
const HOLE_RADIUS = 14;
const TOOLTIP_HEIGHT_ESTIMATE = 200;
const TOOLTIP_GAP = 14;
/** Espacio que tapa la tab bar flotante sobre el contenido scrolleable. */
const TAB_BAR_RESERVE = 130;
/** Deja que la pantalla termine de animar/cargar antes de medir. */
const START_DELAY_MS = 800;
const SCROLL_SETTLE_MS = 450;
const SCROLL_TOP_OFFSET = 160;

export type TourStep = {
  target: string;
  title: string;
  description: string;
  /** El elemento está fuera del ScrollView (header, tab bar): no se scrollea hasta él. */
  fixed?: boolean;
};

type ActiveTour = {
  id: string;
  steps: TourStep[];
  scrollRef?: RefObject<ScrollView | null>;
};

type Rect = { x: number; y: number; width: number; height: number };

type TourContextValue = {
  register: (id: string, ref: RefObject<View | null>) => void;
  unregister: (id: string, ref: RefObject<View | null>) => void;
  start: (tour: ActiveTour) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function measureInWindow(node: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

function measureInScroll(node: View, scroll: ScrollView): Promise<number | null> {
  const inner = (scroll as unknown as { getInnerViewRef?: () => unknown }).getInnerViewRef?.();
  if (!inner) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      node.measureLayout(
        inner as never,
        (_x, y) => resolve(y),
        () => resolve(null),
      );
    } catch {
      resolve(null);
    }
  });
}

function roundedRectPath({ x, y, width: w, height: h }: Rect, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M${x + radius} ${y}`,
    `H${x + w - radius}`,
    `A${radius} ${radius} 0 0 1 ${x + w} ${y + radius}`,
    `V${y + h - radius}`,
    `A${radius} ${radius} 0 0 1 ${x + w - radius} ${y + h}`,
    `H${x + radius}`,
    `A${radius} ${radius} 0 0 1 ${x} ${y + h - radius}`,
    `V${y + radius}`,
    `A${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    'Z',
  ].join(' ');
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const windowSize = useWindowDimensions();
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
  const width = layout?.width ?? windowSize.width;
  const height = layout?.height ?? windowSize.height;
  const insets = useSafeAreaInsets();
  const targets = useRef(new Map<string, RefObject<View | null>>());
  const activeRef = useRef(false);
  const [tour, setTour] = useState<ActiveTour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  const register = useCallback((id: string, ref: RefObject<View | null>) => {
    targets.current.set(id, ref);
  }, []);

  const unregister = useCallback((id: string, ref: RefObject<View | null>) => {
    if (targets.current.get(id) === ref) targets.current.delete(id);
  }, []);

  const start = useCallback((next: ActiveTour) => {
    if (activeRef.current) return;
    const steps = next.steps.filter((step) => targets.current.get(step.target)?.current);
    if (!steps.length) return;
    activeRef.current = true;
    setRect(null);
    setStepIndex(0);
    setTour({ ...next, steps });
  }, []);

  const finish = useCallback(() => {
    if (tour && user?.id) void markScreenTourSeen(user.id, tour.id);
    tour?.scrollRef?.current?.scrollTo({ y: 0, animated: true });
    activeRef.current = false;
    setTour(null);
    setRect(null);
    setStepIndex(0);
  }, [tour, user?.id]);

  const next = useCallback(() => {
    if (!tour) return;
    void hapticSelection();
    if (stepIndex >= tour.steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [tour, stepIndex, finish]);

  const locate = useCallback(
    async (step: TourStep, scrollRef?: RefObject<ScrollView | null>): Promise<Rect | null> => {
      const node = targets.current.get(step.target)?.current;
      if (!node) return null;
      const first = await measureInWindow(node);
      if (!first || step.fixed) return first;

      const visible = first.y >= insets.top && first.y + first.height <= height - TAB_BAR_RESERVE;
      const scroll = scrollRef?.current;
      if (visible || !scroll) return first;

      const contentY = await measureInScroll(node, scroll);
      if (contentY == null) return first;
      scroll.scrollTo({ y: Math.max(0, contentY - SCROLL_TOP_OFFSET), animated: true });
      await wait(SCROLL_SETTLE_MS);
      return measureInWindow(node);
    },
    [height, insets.top],
  );

  useEffect(() => {
    if (!tour) return;
    const step = tour.steps[stepIndex];
    if (!step) return;
    let cancelled = false;
    fade.setValue(0);
    setRect(null);

    void locate(step, tour.scrollRef).then((found) => {
      if (cancelled) return;
      if (!found) {
        if (stepIndex < tour.steps.length - 1) setStepIndex(stepIndex + 1);
        else finish();
        return;
      }
      setRect(found);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });

    return () => {
      cancelled = true;
    };
    // `finish` cambia con `tour`; no hace falta re-medir por eso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, stepIndex, locate, fade]);

  useEffect(() => {
    if (!tour) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => sub.remove();
  }, [tour, finish]);

  const value = useMemo(() => ({ register, unregister, start }), [register, unregister, start]);

  const step = tour?.steps[stepIndex];
  const hole = rect
    ? {
        x: rect.x - HOLE_PADDING,
        y: rect.y - HOLE_PADDING,
        width: rect.width + HOLE_PADDING * 2,
        height: rect.height + HOLE_PADDING * 2,
      }
    : null;

  let tooltipPosition: ViewStyle = { bottom: insets.bottom + 24 };
  if (hole) {
    const belowTop = hole.y + hole.height + TOOLTIP_GAP;
    const fitsBelow = belowTop + TOOLTIP_HEIGHT_ESTIMATE <= height - insets.bottom;
    const fitsAbove = hole.y - TOOLTIP_GAP - TOOLTIP_HEIGHT_ESTIMATE >= insets.top;
    if (fitsBelow) tooltipPosition = { top: belowTop };
    else if (fitsAbove) tooltipPosition = { bottom: height - hole.y + TOOLTIP_GAP };
  }

  const isLast = tour ? stepIndex >= tour.steps.length - 1 : false;

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && step ? (
        <View
          style={StyleSheet.absoluteFill}
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            if (w !== layout?.width || h !== layout?.height) setLayout({ width: w, height: h });
          }}
          onStartShouldSetResponder={() => true}
          accessibilityViewIsModal
        >
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Path
              d={`M0 0H${width}V${height}H0Z ${hole ? roundedRectPath(hole, HOLE_RADIUS) : ''}`}
              fill={OVERLAY}
              fillRule="evenodd"
            />
          </Svg>

          {hole ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: hole.x,
                top: hole.y,
                width: hole.width,
                height: hole.height,
                borderRadius: HOLE_RADIUS,
                borderWidth: 2,
                borderColor: LIME,
                opacity: fade,
              }}
            />
          ) : null}

          {hole ? (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 16,
                  right: 16,
                  backgroundColor: '#161616',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(215,255,0,0.35)',
                  padding: 18,
                  opacity: fade,
                },
                tooltipPosition,
              ]}
            >
              <Text style={{ color: LIME, fontFamily: fontFamily.regular, fontSize: 12, marginBottom: 6 }}>
                {stepIndex + 1} de {tour.steps.length}
              </Text>
              <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 18, marginBottom: 6 }}>
                {step.title}
              </Text>
              <Text style={{ color: '#D4D4D8', fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 }}>
                {step.description}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 16,
                }}
              >
                {!isLast ? (
                  <TouchableOpacity onPress={finish} hitSlop={10} accessibilityRole="button">
                    <Text style={{ color: MUTED, fontFamily: fontFamily.regular, fontSize: 14 }}>
                      Saltar tutorial
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}
                <TouchableOpacity
                  onPress={next}
                  accessibilityRole="button"
                  style={{
                    backgroundColor: LIME,
                    borderRadius: 999,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: '#000000', fontFamily: fontFamily.regular, fontSize: 14 }}>
                    {isLast ? 'Entendido' : 'Siguiente'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </TourContext.Provider>
  );
}

/** Marca un elemento para que el tutorial pueda resaltarlo. */
export function TourTarget({
  id,
  children,
  style,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ctx = useContext(TourContext);
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!ctx) return;
    ctx.register(id, ref);
    return () => ctx.unregister(id, ref);
  }, [ctx, id]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

/**
 * Muestra el tutorial de la pantalla la primera vez que el usuario la abre.
 * Los pasos cuyo `target` no esté montado se omiten.
 */
export function useScreenTour(
  tourId: string,
  steps: TourStep[],
  options: { enabled?: boolean; scrollRef?: RefObject<ScrollView | null> } = {},
) {
  const ctx = useContext(TourContext);
  const { user } = useAuth();
  const { enabled = true, scrollRef } = options;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const userId = user?.id;
  const blocked = !user || needsPlayerOnboarding(user);

  useFocusEffect(
    useCallback(() => {
      if (!ctx || !enabled || !userId || blocked) return;
      let cancelled = false;
      const timer = setTimeout(() => {
        void hasSeenScreenTour(userId, tourId).then((seen) => {
          if (cancelled || seen) return;
          ctx.start({ id: tourId, steps: stepsRef.current, scrollRef });
        });
      }, START_DELAY_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [ctx, enabled, userId, blocked, tourId, scrollRef]),
  );

  /** Arranca el tutorial ahora, aunque ya se haya visto. */
  const replay = useCallback(() => {
    ctx?.start({ id: tourId, steps: stepsRef.current, scrollRef });
  }, [ctx, tourId, scrollRef]);

  return { replay };
}
