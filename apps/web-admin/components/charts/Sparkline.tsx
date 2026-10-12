import { useId } from 'react';

const W = 120;
const H = 36;

export function Sparkline({ values, tone = 'primary' }: { values: number[]; tone?: 'primary' | 'warning' }) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const step = W / (values.length - 1);
  const points = values.map((value, index) => [index * step, H - 2 - (value / max) * (H - 4)]);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M0,${H} L${line.replaceAll(' ', ' L')} L${W},${H} Z`;
  const color = tone === 'warning' ? 'var(--warning)' : 'var(--primary)';

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
