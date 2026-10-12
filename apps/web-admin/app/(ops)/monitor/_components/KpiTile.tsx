import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatCompact, formatNumber } from '@/lib/format';

type KpiTileProps = {
  href: string;
  label: string;
  value: number;
  icon: LucideIcon;
  series?: number[];
  index: number;
};

export function KpiTile({ href, label, value, icon: Icon, series, index }: KpiTileProps) {
  const thisWeek = series?.at(-1) ?? null;
  const lastWeek = series?.at(-2) ?? null;
  const trendUp = thisWeek != null && lastWeek != null && thisWeek >= lastWeek;

  return (
    <Link
      href={href}
      className="bento-tile kpi-tile reveal"
      style={{ '--reveal-index': index } as React.CSSProperties}
    >
      <span className="kpi-tile-head">
        <span className="kpi-tile-icon" aria-hidden>
          <Icon size={16} />
        </span>
        <span className="kpi-tile-label">{label}</span>
      </span>
      <span className="kpi-tile-value num" title={formatNumber(value)}>
        {formatCompact(value)}
      </span>
      <span className="kpi-tile-foot">
        {thisWeek != null ? (
          <span className={`kpi-delta${trendUp ? ' kpi-delta--up' : ''}`}>
            +{formatNumber(thisWeek)} esta semana
          </span>
        ) : (
          <span className="kpi-delta">Sin datos semanales</span>
        )}
        {series ? <Sparkline values={series} /> : null}
      </span>
    </Link>
  );
}
