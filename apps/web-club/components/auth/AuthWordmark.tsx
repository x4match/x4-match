import { useId } from 'react';

const WHITE_STOPS = ['white', '#2C2A2A'] as const;
const ACCENT_STOPS = ['#F3FF6D', '#3C4100'] as const;

/** Letras de "X4MATCH" dibujadas en vertical (de abajo hacia arriba); el SVG las rota a horizontal. */
const LETTERS: Array<{
  d: string;
  strokeWidth?: number;
  stops: readonly [string, string];
  gradient: [number, number, number, number];
}> = [
  {
    d: 'M65.0642 495.242V512.666L41.7184 534.673L65.0642 554.385V573.466L32.7861 542.937L1.52673 572.699L1.52673 554.378L23.086 534.156L1.52673 515.075L1.52673 496.633L32.9153 524.616L65.0642 495.234V495.242Z',
    stops: WHITE_STOPS,
    gradient: [33.2954, 495.234, 33.2954, 573.466],
  },
  {
    d: 'M51.1599 420.004V434.76H65.8317L65.8317 447.607H51.1599L51.1599 493.782H39.4224L1.27563 448.117L1.27563 434.76H39.4224V420.004H51.1599ZM39.4224 447.607H16.1983L39.4224 477.118L39.4224 447.607Z',
    stops: WHITE_STOPS,
    gradient: [33.5537, 420.004, 33.5537, 493.782],
  },
  {
    d: 'M65.1152 327.693V340.441H19.0445L41.692 367.777L19.0445 395.365H65.1152V407.743H1.48975L1.48975 394.994L25.031 367.777L1.48975 340.189L1.48975 327.676H65.1152V327.693Z',
    strokeWidth: 0.75,
    stops: ACCENT_STOPS,
    gradient: [33.3025, 407.743, 33.3025, 327.676],
  },
  {
    d: 'M65.1152 227.323L65.1152 240.932L51.2367 248.909L51.2367 288.639L65.1152 296.244V310.342L1.48975 275.89L1.48975 262.281L65.1152 227.34V227.323ZM39.6684 255.283L13.8337 269.01L39.6684 282.618V255.283Z',
    strokeWidth: 0.75,
    stops: ACCENT_STOPS,
    gradient: [33.3025, 310.342, 33.3025, 227.323],
  },
  {
    d: 'M13.0758 165.147L13.0758 192.112H65.133V206.463H13.0758L13.0758 233.309H1.74365L1.74365 165.147H13.0758Z',
    strokeWidth: 0.75,
    stops: ACCENT_STOPS,
    gradient: [33.4383, 233.309, 33.4383, 165.147],
  },
  {
    d: 'M48.874 86.9351C54.8099 86.9351 58.8065 88.0144 60.8301 90.1898C62.8706 92.3651 63.8824 96.3449 63.8824 102.146L63.8824 138.554C63.8824 144.355 62.8706 148.335 60.8301 150.51C58.7896 152.669 54.8099 153.765 48.874 153.765H15.4002C9.54862 153.765 5.58574 152.685 3.49468 150.51C1.42049 148.352 0.375 144.355 0.375 138.554L0.375 102.146C0.459317 92.3315 3.98372 87.2724 10.9314 86.952H20.2232V101.168H11.6903L11.6903 139.549H51.9094L51.9094 101.168H42.6177V86.952H48.8572L48.874 86.9351Z',
    strokeWidth: 0.75,
    stops: ACCENT_STOPS,
    gradient: [32.1287, 153.765, 32.1287, 86.9351],
  },
  {
    d: 'M65.1157 0.374945V14.7256H39.0281L39.0281 57.997H65.1157V72.2129L1.60828 72.2129L1.60828 57.997H26.1782L26.1782 14.7256H1.60828L1.60828 0.374945L65.1157 0.374945Z',
    strokeWidth: 0.75,
    stops: ACCENT_STOPS,
    gradient: [33.362, 72.2129, 33.362, 0.374947],
  },
];

/** Logo "X4MATCH" en contorno, horizontal y al ancho de su contenedor. */
export function AuthWordmark({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      aria-hidden
      viewBox="0 0 575 67"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none block h-auto w-full ${className}`}
    >
      <g transform="translate(575 0) rotate(90)">
        {LETTERS.map((letter, index) => (
          <path
            key={index}
            d={letter.d}
            stroke={`url(#${id}-${index})`}
            strokeWidth={letter.strokeWidth}
            strokeMiterlimit="10"
          />
        ))}
      </g>
      <defs>
        {LETTERS.map((letter, index) => {
          const [x1, y1, x2, y2] = letter.gradient;
          return (
            <linearGradient
              key={index}
              id={`${id}-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor={letter.stops[0]} />
              <stop offset="1" stopColor={letter.stops[1]} />
            </linearGradient>
          );
        })}
      </defs>
    </svg>
  );
}
