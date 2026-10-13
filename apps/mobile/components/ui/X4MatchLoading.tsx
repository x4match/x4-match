import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useReduceMotion } from '@/lib/reduce-motion';

/* Geometría tomada de assets/x4match.svg (viewBox 512×512). */

const BRAND = '#E6FA0A';

const VB_X = 32;
const VB_Y = 52;
const VB_W = 448;
const VB_H_WITH_TEXT = 408;
const VB_H_MARK_ONLY = 232;

/* La estela del logo partida en el pique (x = 229.84) para revelar cada tramo por separado. */
const TRAJECTORY_DESCENT_PATH =
  'M63.57 237.29C82.71 148.31 149.37 86.64 212.98 185.64L229.84 226.21L229.83 251.11L210.93 207.04C159.3 110.34 90.3 154.93 64.94 240.05C63.86 240.96 63.4 240.03 63.55 237.28L63.57 237.29Z';
const TRAJECTORY_ASCENT_PATH =
  'M229.84 226.21C248.97 166.5 295.17 102.28 363.52 98.84C368.65 98.58 376.86 97.71 380.89 100.98C303.54 110.99 253.06 182.35 229.83 251.11Z';
const TRAJECTORY_TAIL_PATH =
  'M64.95 240.06C63.47 245.02 62.89 246.17 59.42 256.67C60 250.08 62.19 243.7 63.56 237.3L64.95 240.07V240.06Z';

const TEXT_X_PATH =
  'M256.36 359.95H233.44L204.49 329.24L178.56 359.95H153.46L193.62 317.49L154.47 276.37H178.57L205.17 304.73L230.27 276.37H254.53L217.72 317.66L256.37 359.95H256.36Z';
const TEXT_4_PATH =
  'M355.33 341.66H335.92V360.96H319.02V341.66H258.28V326.22L318.35 276.04H335.92V326.22H355.33V341.66ZM319.02 326.22V295.67L280.2 326.22H319.02Z';
const TEXT_MATCH_PATHS = [
  'M181.08 421.34H173.52V394.02L157.31 407.45L140.95 394.02V421.34H133.61V383.61H141.17L157.31 397.57L173.67 383.61H181.09V421.34H181.08Z',
  'M240.6 421.34H232.53L227.8 413.11H204.24L199.73 421.34H191.37L211.8 383.61H219.87L240.59 421.34H240.6ZM224.02 406.25L215.88 390.93L207.81 406.25H224.02Z',
  'M277.47 390.48H261.48V421.35H252.97V390.48H237.05V383.76H277.47V390.48Z',
  'M323.85 411.71C323.85 415.23 323.21 417.6 321.92 418.8C320.63 420.01 318.27 420.61 314.83 420.61H293.24C289.8 420.61 287.44 420.01 286.15 418.8C284.87 417.59 284.22 415.23 284.22 411.71V391.86C284.22 388.39 284.86 386.04 286.15 384.8C287.43 383.57 289.8 382.95 293.24 382.95H314.83C320.65 383 323.65 385.09 323.84 389.21V394.72H315.41V389.66H292.65V413.51H315.41V408H323.84V411.7L323.85 411.71Z',
  'M375.18 421.34H366.67V405.87H341.01V421.34H332.58V383.68H341.01V398.25H366.67V383.68H375.18V421.34Z',
];

const BALL_CENTER = { x: 425.7, y: 93.7 };
const BALL_RADIUS = 30.5;
const BALL_BOX = 66;
const BALL_VIEWBOX = `${BALL_CENTER.x - BALL_BOX / 2} ${BALL_CENTER.y - BALL_BOX / 2} ${BALL_BOX} ${BALL_BOX}`;
const BALL_PATHS = {
  right:
    'M445.76 116.77C443.26 119.06 440.38 120.94 437.25 122.26C429.17 125.68 419.54 125.05 411.87 120.8C408.04 118.69 404.73 115.73 402.13 112.22C407.13 116.85 414.19 119.38 420.93 118.32C427.72 117.25 433.92 112.32 435.9 105.74C436.02 105.32 436.13 104.9 436.23 104.47C437.31 99.44 436.11 94.07 433.94 89.38C432.52 86.32 430.69 83.42 429.85 80.15C428.45 74.59 430.36 68.32 434.63 64.49L434.68 64.33C434.94 64.41 435.21 64.49 435.47 64.59C445.49 68.17 453.3 77.31 455.34 87.75C455.53 88.76 455.68 89.78 455.77 90.8C456.61 100.35 452.84 110.26 445.75 116.76L445.76 116.77Z',
  seam: 'M436.24 104.46C436.15 104.89 436.04 105.31 435.91 105.73C433.93 112.31 427.74 117.25 420.94 118.31C414.2 119.37 407.14 116.84 402.14 112.21C400.24 109.67 397.35 106.58 396.29 103.6C400.65 109.45 409.23 114.35 416.51 114.49C422.88 114.6 429.41 110.79 431.86 105.03C432.21 104.21 432.47 103.34 432.65 102.45C433.51 97.94 431.98 93.33 430.17 89.11C428.35 84.89 426.19 80.71 425.66 76.14C425.13 71.58 427.5 65.73 431.5 63.49C432.57 63.7 433.64 63.96 434.69 64.31L434.64 64.47C430.37 68.3 428.46 74.56 429.86 80.13C430.69 83.4 432.53 86.3 433.95 89.36C436.12 94.05 437.32 99.42 436.24 104.45V104.46Z',
  left: 'M432.64 102.46C432.47 103.35 432.2 104.23 431.85 105.04C429.4 110.79 422.88 114.61 416.5 114.5C409.22 114.36 400.34 108.84 397.8 103.83C397.27 102.64 396.45 100.94 396.22 99.7C394.62 91.04 396.15 84.81 399.82 78.15C401.45 75.18 403.56 72.5 406.12 70.27C412.88 64.39 422.51 61.76 431.49 63.52C427.48 65.76 425.12 71.61 425.65 76.17C426.17 80.74 428.34 84.92 430.16 89.14C431.97 93.36 433.5 97.97 432.64 102.48V102.46Z',
};

/* Recorrido de la pelota: línea media de la estela del logo. */

type Point = { x: number; y: number };
type Cubic = readonly [Point, Point, Point, Point];

const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const straight = (a: Point, b: Point): Cubic => [a, lerpPoint(a, b, 1 / 3), lerpPoint(a, b, 2 / 3), b];

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

const START = { x: 64.26, y: 238.67 };
const BOUNCE = { x: 229.84, y: 238.66 };
const TRAIL_END = { x: 374, y: 99.8 };

const DESCENT_CURVES: readonly Cubic[] = [
  [START, { x: 86.5, y: 151.62 }, { x: 154.34, y: 98.49 }, { x: 211.96, y: 196.34 }],
  straight({ x: 211.96, y: 196.34 }, BOUNCE),
];

const ASCENT_CURVES: readonly Cubic[] = [
  [BOUNCE, { x: 251, y: 174.4 }, { x: 299.4, y: 106.6 }, TRAIL_END],
  [TRAIL_END, { x: 389.9, y: 98.3 }, { x: 410, y: 95.5 }, BALL_CENTER],
];

function flatten(curves: readonly Cubic[], steps = 48): Point[] {
  const pts: Point[] = [curves[0][0]];
  for (const curve of curves) {
    for (let i = 1; i <= steps; i += 1) pts.push(cubicAt(curve, i / steps));
  }
  return pts;
}

function polylineLength(pts: Point[]): number {
  let length = 0;
  for (let i = 1; i < pts.length; i += 1) {
    length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return length;
}

const toPathData = (curves: readonly Cubic[]) =>
  curves.reduce(
    (d, [, c1, c2, p]) => `${d} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p.x} ${p.y}`,
    `M${curves[0][0].x} ${curves[0][0].y}`,
  );

const reverseCurves = (curves: readonly Cubic[]): Cubic[] =>
  [...curves].reverse().map(([p0, p1, p2, p3]) => [p3, p2, p1, p0] as const);

const extend = (from: Point, toward: Point, distance: number): Point => {
  const len = Math.hypot(toward.x - from.x, toward.y - from.y) || 1;
  return {
    x: from.x + ((toward.x - from.x) / len) * distance,
    y: from.y + ((toward.y - from.y) / len) * distance,
  };
};

/**
 * La estela se oculta con trazos del color del fondo sobre su línea media; el
 * trazo se retira detrás de la pelota (strokeDashoffset) y deja ver la forma
 * exacta del logo. Cada tapa se extiende un poco más allá del pique porque el
 * corte recto (butt) no alcanza a cubrir las puntas de la V.
 */
const TAIL_TIP = { x: 59.42, y: 256.67 };
const TRAIL_TIP = { x: 386, y: 100.6 };
const COVER_WIDTH = 42;
const ASCENT_LEAD = 14;

const DESCENT_COVER_CURVES: readonly Cubic[] = [
  straight(TAIL_TIP, START),
  ...DESCENT_CURVES,
  straight(BOUNCE, extend({ x: 211.96, y: 196.34 }, BOUNCE, Math.hypot(17.88, 42.32) + 24)),
];
const ASCENT_COVER_CURVES: readonly Cubic[] = [
  straight(extend(BOUNCE, ASCENT_CURVES[0][1], -ASCENT_LEAD), BOUNCE),
  ASCENT_CURVES[0],
  straight(TRAIL_END, TRAIL_TIP),
];

const TAIL_LENGTH = Math.hypot(START.x - TAIL_TIP.x, START.y - TAIL_TIP.y);
const DESCENT_COVER_LENGTH = polylineLength(flatten(DESCENT_COVER_CURVES));
const ASCENT_COVER_LENGTH = polylineLength(flatten(ASCENT_COVER_CURVES));
/* Trazados al revés: el tramo visible del dash arranca en el final y retrocede hasta la pelota. */
const DESCENT_COVER_PATH = toPathData(reverseCurves(DESCENT_COVER_CURVES));
const ASCENT_COVER_PATH = toPathData(reverseCurves(ASCENT_COVER_CURVES));

/**
 * Tabla precalculada (una vez, en JS) con la posición de la pelota a intervalos
 * de tiempo uniformes. La velocidad sale de la conservación de energía
 * (más rápida cuanto más baja), así que el reloj de Reanimated puede avanzar
 * linealmente y el movimiento igual acelera al bajar y frena al subir.
 */
type Track = { x: number[]; y: number[]; s: number[]; length: number; time: number };

type SpeedFn = (y: number, apexY: number, traveled: number, remaining: number) => number;

function buildTrack(curves: readonly Cubic[], speedAt: SpeedFn, samples = 96): Track {
  const pts = flatten(curves);

  const dist = [0];
  for (let i = 1; i < pts.length; i += 1) {
    dist.push(dist[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const length = dist[dist.length - 1];
  const apexY = Math.min(...pts.map((p) => p.y));

  const time = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const midY = (pts[i].y + pts[i - 1].y) / 2;
    const midS = (dist[i] + dist[i - 1]) / 2;
    const speed = Math.max(0.5, speedAt(midY, apexY, midS, length - midS));
    time.push(time[i - 1] + (dist[i] - dist[i - 1]) / speed);
  }
  const total = time[time.length - 1];

  const x: number[] = [];
  const y: number[] = [];
  const s: number[] = [];
  let j = 0;
  for (let k = 0; k <= samples; k += 1) {
    const target = (total * k) / samples;
    while (j < pts.length - 2 && time[j + 1] < target) j += 1;
    const f = Math.min(1, Math.max(0, (target - time[j]) / (time[j + 1] - time[j] || 1)));
    const p = lerpPoint(pts[j], pts[j + 1], f);
    x.push(p.x);
    y.push(p.y);
    s.push(dist[j] + (dist[j + 1] - dist[j]) * f);
  }

  return { x, y, s, length, time: total };
}

const projectileSpeed = (y: number, apexY: number, apexSpeedSq: number) =>
  Math.sqrt(apexSpeedSq + Math.max(0, y - apexY));

const DESCENT = buildTrack(DESCENT_CURVES, (y, apexY, traveled) =>
  Math.min(projectileSpeed(y, apexY, 30), Math.sqrt(4.2 * traveled)),
);
const ASCENT = buildTrack(ASCENT_CURVES, (y, apexY, _traveled, remaining) =>
  Math.min(projectileSpeed(y, apexY, 40), Math.sqrt(0.84 * remaining)),
);

const TOTAL_LENGTH = DESCENT.length + ASCENT.length;
const BALL_TURNS = Math.max(1, Math.round((TOTAL_LENGTH / (2 * Math.PI * BALL_RADIUS)) * 0.9));
/** Vueltas enteras: al llegar al extremo la costura queda igual que en el logo. */
const DEG_PER_UNIT = (360 * BALL_TURNS) / TOTAL_LENGTH;
const DESCENT_SHARE = DESCENT.time / (DESCENT.time + ASCENT.time);

/* Pique: estira al caer → aplasta contra el piso → rebota estirándose → sale. */
const SQUASH = 0.42;
const STRETCH = 0.16;
/* Perfil del pique (0→1 del rebote): impacto rápido, se sostiene aplastada y rebota estirada. */
const BOUNCE_STEPS = [0, 0.28, 0.45, 0.8, 1];
const BOUNCE_SHAPE = [0, SQUASH, SQUASH, -STRETCH, -STRETCH];
const PRE_STRETCH_WINDOW = 0.14;
const POST_STRETCH_WINDOW = 0.16;

/* Tramo del reloj (dentro de la subida) en el que aparece "X4 MATCH". */
const TEXT_IN_FROM = 2.05;
const TEXT_IN_TO = 2.6;

const FADE_MS = 90;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function sampleTrack(track: Track, u: number) {
  'worklet';
  const n = track.x.length - 1;
  const f = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const k = f - i;
  return {
    x: track.x[i] + (track.x[i + 1] - track.x[i]) * k,
    y: track.y[i] + (track.y[i + 1] - track.y[i]) * k,
    s: track.s[i] + (track.s[i + 1] - track.s[i]) * k,
  };
}

function trackAngle(track: Track, u: number) {
  'worklet';
  const a = sampleTrack(track, u - 0.01);
  const b = sampleTrack(track, u + 0.01);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export type X4MatchLoadingProps = {
  /** Ancho del logo en px; el alto se calcula manteniendo la proporción. */
  size?: number;
  /** Ms que tarda la pelota en recorrer toda la trayectoria (sin contar rebote ni pausa). */
  duration?: number;
  /** Ms del squash & stretch al picar en el punto inferior. */
  bounceDuration?: number;
  /** Ms de pausa con la pelota en el extremo superior derecho antes de repetir. */
  pauseDuration?: number;
  loop?: boolean;
  /** Con `loop={false}`: se llama cuando la pelota llega al punto final. */
  onFinish?: () => void;
  showText?: boolean;
  /** Tiene que coincidir con el fondo de la pantalla: con él se oculta la estela aún no recorrida. */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function X4MatchLoading({
  size = 240,
  duration = 1400,
  bounceDuration = 150,
  pauseDuration = 200,
  loop = true,
  onFinish,
  showText = true,
  backgroundColor = '#000000',
  style,
  accessibilityLabel = 'Cargando x4 match',
}: X4MatchLoadingProps) {
  const reduceMotion = useReduceMotion();

  const vbH = showText ? VB_H_WITH_TEXT : VB_H_MARK_ONLY;
  const viewBox = `${VB_X} ${VB_Y} ${VB_W} ${vbH}`;
  const scale = size / VB_W;
  const height = vbH * scale;
  const ballPx = BALL_BOX * scale;
  const ballRadiusPx = BALL_RADIUS * scale;

  const descentMs = Math.max(1, duration * DESCENT_SHARE);
  const ascentMs = Math.max(1, duration - descentMs);
  const fadeInUntil = Math.min(0.3, FADE_MS / descentMs);
  const fadeOutFrom = 3 + Math.max(0, 1 - FADE_MS / Math.max(1, pauseDuration));

  // clock: 0→1 primera curva · 1→2 rebote · 2→3 segunda curva · 3→4 pausa
  const clock = useSharedValue(0);
  const pulse = useSharedValue(1);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const notifyFinish = useCallback(() => onFinishRef.current?.(), []);

  useEffect(() => {
    if (reduceMotion) {
      clock.value = 3;
      if (!loop) notifyFinish();
      pulse.value = loop
        ? withRepeat(
            withSequence(
              withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
              withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
            ),
            -1,
          )
        : 1;
      return () => cancelAnimation(pulse);
    }

    pulse.value = 1;
    clock.value = 0;
    const linear = { easing: Easing.linear };
    const descent = withTiming(1, { ...linear, duration: descentMs });
    const bounce = withTiming(2, { ...linear, duration: Math.max(1, bounceDuration) });

    clock.value = loop
      ? withRepeat(
          withSequence(
            descent,
            bounce,
            withTiming(3, { ...linear, duration: ascentMs }),
            withTiming(4, { ...linear, duration: Math.max(0, pauseDuration) }),
          ),
          -1,
        )
      : withSequence(
          descent,
          bounce,
          withTiming(3, { ...linear, duration: ascentMs }, (finished) => {
            if (finished) runOnJS(notifyFinish)();
          }),
        );

    return () => cancelAnimation(clock);
  }, [ascentMs, bounceDuration, clock, descentMs, loop, notifyFinish, pauseDuration, pulse, reduceMotion]);

  const ballStyle = useAnimatedStyle(() => {
    const c = clock.value;
    let x = BALL_CENTER.x;
    let y = BALL_CENTER.y;
    let traveled = TOTAL_LENGTH;
    let scaleX = 1;
    let scaleY = 1;
    let stretch = 0;
    let heading = 0;
    let opacity = 1;

    if (c < 1) {
      const p = sampleTrack(DESCENT, c);
      x = p.x;
      y = p.y;
      traveled = p.s;
      opacity = interpolate(c, [0, fadeInUntil], [0, 1], Extrapolation.CLAMP);
      stretch = interpolate(c, [1 - PRE_STRETCH_WINDOW, 1], [0, STRETCH], Extrapolation.CLAMP);
      heading = trackAngle(DESCENT, c);
    } else if (c < 2) {
      // > 0 aplasta contra el piso; < 0 estira en vertical antes de salir.
      const squash = interpolate(c - 1, BOUNCE_STEPS, BOUNCE_SHAPE, Extrapolation.CLAMP);
      x = BOUNCE.x;
      y = BOUNCE.y;
      traveled = DESCENT.length;
      scaleX = squash > 0 ? 1 + squash : 1 + squash * 0.6;
      scaleY = 1 - squash;
    } else if (c < 3) {
      const p = sampleTrack(ASCENT, c - 2);
      x = p.x;
      y = p.y;
      traveled = DESCENT.length + p.s;
      stretch = interpolate(c, [2, 2 + POST_STRETCH_WINDOW], [STRETCH, 0], Extrapolation.CLAMP);
      heading = trackAngle(ASCENT, c - 2);
    } else if (fadeOutFrom < 4) {
      opacity = interpolate(c, [fadeOutFrom, 4], [1, 0], Extrapolation.CLAMP);
    }

    return {
      opacity: opacity * pulse.value,
      transform: [
        { translateX: (x - VB_X) * scale - ballPx / 2 },
        // El squash se ancla en el punto de contacto (base de la pelota).
        { translateY: (y - VB_Y) * scale - ballPx / 2 + ballRadiusPx * (1 - scaleY) },
        // Estiramiento sobre la dirección de vuelo, independiente del giro de la pelota.
        { rotate: `${heading}rad` },
        { scaleX: 1 + stretch },
        { scaleY: 1 - stretch * 0.6 },
        { rotate: `${-heading}rad` },
        { scaleX },
        { scaleY },
        { rotate: `${traveled * DEG_PER_UNIT}deg` },
      ],
    };
  });

  const trailStyle = useAnimatedStyle(() => ({
    opacity:
      clock.value >= 3 && fadeOutFrom < 4
        ? interpolate(clock.value, [fadeOutFrom, 4], [1, 0], Extrapolation.CLAMP)
        : 1,
  }));

  const textStyle = useAnimatedStyle(() => {
    const c = clock.value;
    const appear =
      c >= 3
        ? fadeOutFrom < 4
          ? interpolate(c, [fadeOutFrom, 4], [1, 0], Extrapolation.CLAMP)
          : 1
        : interpolate(c, [TEXT_IN_FROM, TEXT_IN_TO], [0, 1], Extrapolation.CLAMP);
    const eased = 1 - (1 - appear) * (1 - appear);
    return {
      opacity: appear,
      transform: [{ translateY: (1 - eased) * 10 * scale }],
    };
  });

  const descentCoverProps = useAnimatedProps(() => {
    const c = clock.value;
    const revealed =
      c < 1
        ? TAIL_LENGTH * Math.min(1, c / fadeInUntil) + sampleTrack(DESCENT, c).s
        : DESCENT_COVER_LENGTH;
    return { strokeDashoffset: Math.min(revealed, DESCENT_COVER_LENGTH) };
  });

  const ascentCoverProps = useAnimatedProps(() => {
    const c = clock.value;
    let revealed = ASCENT_COVER_LENGTH;
    if (c < 1) revealed = 0;
    else if (c < 2) revealed = ASCENT_LEAD;
    else if (c < 3) revealed = ASCENT_LEAD + sampleTrack(ASCENT, c - 2).s;
    return { strokeDashoffset: Math.min(revealed, ASCENT_COVER_LENGTH) };
  });

  return (
    <View
      style={[{ width: size, height }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      {showText ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, textStyle]}>
          <Svg width={size} height={height} viewBox={viewBox}>
            <G strokeWidth={0.75} strokeMiterlimit={10}>
              <Path d={TEXT_X_PATH} fill="#FFFFFF" stroke="#FFFFFF" />
              <Path d={TEXT_4_PATH} fill="#FFFFFF" stroke="#FFFFFF" />
              {TEXT_MATCH_PATHS.map((d) => (
                <Path key={d} d={d} fill={BRAND} stroke={BRAND} />
              ))}
            </G>
          </Svg>
        </Animated.View>
      ) : null}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, trailStyle]}>
        <Svg width={size} height={height} viewBox={viewBox}>
          {/* El tramo de bajada va encima para que su tapa no corte la punta de la V ya recorrida. */}
          <Path d={TRAJECTORY_ASCENT_PATH} fill={BRAND} />
          <AnimatedPath
            d={ASCENT_COVER_PATH}
            fill="none"
            stroke={backgroundColor}
            strokeWidth={COVER_WIDTH}
            strokeDasharray={[ASCENT_COVER_LENGTH, ASCENT_COVER_LENGTH]}
            animatedProps={ascentCoverProps}
          />
          <Path d={TRAJECTORY_DESCENT_PATH} fill={BRAND} />
          <Path d={TRAJECTORY_TAIL_PATH} fill={BRAND} />
          <AnimatedPath
            d={DESCENT_COVER_PATH}
            fill="none"
            stroke={backgroundColor}
            strokeWidth={COVER_WIDTH}
            strokeDasharray={[DESCENT_COVER_LENGTH, DESCENT_COVER_LENGTH]}
            animatedProps={descentCoverProps}
          />
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.ball, { width: ballPx, height: ballPx }, ballStyle]}
      >
        <Svg width={ballPx} height={ballPx} viewBox={BALL_VIEWBOX}>
          <Circle cx={BALL_CENTER.x} cy={BALL_CENTER.y} r={BALL_RADIUS - 2.5} fill="#000000" />
          <Path d={BALL_PATHS.right} fill={BRAND} />
          <Path d={BALL_PATHS.seam} fill="#000000" stroke="#000000" strokeWidth={0.75} strokeMiterlimit={10} />
          <Path d={BALL_PATHS.left} fill={BRAND} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
