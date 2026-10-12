'use client';

import { useId, useState, type KeyboardEvent } from 'react';

export type TrendPoint = { label: string; value: number };

type TrendChartProps = {
  data: TrendPoint[];
  variant?: 'area' | 'bar';
  seriesLabel: string;
  formatValue?: (value: number) => string;
  formatAxis?: (value: number) => string;
  height?: number;
};

const W = 600;
const GRID_LINES = 4;
const MAX_X_LABELS = 6;

function niceMax(value: number) {
  if (value <= 0) return GRID_LINES;
  const rawStep = value / GRID_LINES;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return Math.max(nice * magnitude, 1) * GRID_LINES;
}

export function TrendChart({
  data,
  variant = 'area',
  seriesLabel,
  formatValue = (value) => String(value),
  formatAxis = formatValue,
  height = 220,
}: TrendChartProps) {
  const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="chart-empty">Sin datos para el período.</p>;
  }

  const H = height;
  const max = niceMax(Math.max(...data.map((point) => point.value)));
  const slot = W / data.length;
  const x = (index: number) => slot * (index + 0.5);
  const y = (value: number) => H - (value / max) * (H - 8);

  const linePoints = data.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`);
  const areaPath = `M${x(0)},${H} L${linePoints.join(' L')} L${x(data.length - 1)},${H} Z`;
  const gridValues = Array.from({ length: GRID_LINES + 1 }, (_, index) => (max / GRID_LINES) * index);
  const labelEvery = Math.ceil(data.length / MAX_X_LABELS);
  const showXLabel = (index: number) => (data.length - 1 - index) % labelEvery === 0;

  const activePoint = active != null ? data[active] : null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setActive((current) => {
        const base = current ?? data.length - 1;
        return Math.min(Math.max(base + delta, 0), data.length - 1);
      });
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  };

  return (
    <div className="chart">
      <div className="chart-y-axis" style={{ height: H }} aria-hidden>
        {gridValues.map((value) => (
          <span key={value} style={{ top: `${(y(value) / H) * 100}%` }}>
            {formatAxis(value)}
          </span>
        ))}
      </div>

      <div className="chart-body">
        <div
          className="chart-plot"
          style={{ height: H }}
          tabIndex={0}
          role="img"
          aria-label={`${seriesLabel}: gráfico de ${data.length} semanas. Usá las flechas para recorrer los valores.`}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? data.length - 1)}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable="false">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {gridValues.map((value) => (
              <line
                key={value}
                x1={0}
                x2={W}
                y1={y(value)}
                y2={y(value)}
                className="chart-grid-line"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {variant === 'area' ? (
              <>
                <path d={areaPath} fill={`url(#${gradientId})`} />
                <polyline
                  points={linePoints.join(' ')}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {active != null ? (
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={0}
                    y2={H}
                    className="chart-cursor"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </>
            ) : (
              data.map((point, index) => {
                const barWidth = slot * 0.56;
                const top = y(point.value);
                return (
                  <rect
                    key={point.label}
                    x={x(index) - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={Math.max(H - top, point.value > 0 ? 2 : 0)}
                    rx={4}
                    className={`chart-bar${active === index ? ' chart-bar--active' : ''}`}
                  />
                );
              })
            )}
          </svg>

          {variant === 'area' && activePoint ? (
            <span
              className="chart-dot"
              style={{
                left: `${(x(active!) / W) * 100}%`,
                top: `${(y(activePoint.value) / H) * 100}%`,
              }}
              aria-hidden
            />
          ) : null}

          <div className="chart-hit-row" aria-hidden>
            {data.map((point, index) => (
              <span key={point.label} onMouseEnter={() => setActive(index)} />
            ))}
          </div>

          {activePoint ? (
            <div
              className="chart-tooltip"
              style={{ left: `${(x(active!) / W) * 100}%` }}
              aria-live="polite"
            >
              <span className="chart-tooltip-label">Semana del {activePoint.label}</span>
              <strong className="num">{formatValue(activePoint.value)}</strong>
            </div>
          ) : null}
        </div>

        <div className="chart-x-axis" aria-hidden>
          {data.map((point, index) => (
            <span key={point.label} className={showXLabel(index) ? undefined : 'chart-x-hidden'}>
              {point.label}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>{seriesLabel} por semana</caption>
        <thead>
          <tr>
            <th scope="col">Semana</th>
            <th scope="col">{seriesLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <td>{point.label}</td>
              <td>{formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
