import { BILLING_STATUS_LABELS } from '@/lib/labels';
import { formatNumber } from '@/lib/format';

const STATUS_ORDER = ['ACTIVE', 'TRIAL', 'GRACE', 'NOT_STARTED', 'SUSPENDED', 'CANCELLED'];

export function BillingBreakdown({ rows }: { rows: { status: string; count: number }[] }) {
  const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
  const segments = STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 })).filter(
    (segment) => segment.count > 0,
  );
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  return (
    <section className="bento-tile" aria-labelledby="billing-title">
      <header className="tile-header">
        <div>
          <h2 id="billing-title" className="tile-title">
            Estado de facturación
          </h2>
          <p className="tile-subtitle">
            <span className="num">{formatNumber(total)}</span> clubes con plan configurado
          </p>
        </div>
      </header>

      {total === 0 ? (
        <p className="chart-empty">Todavía no hay clubes con facturación.</p>
      ) : (
        <>
          <div className="stack-bar" aria-hidden>
            {segments.map((segment) => (
              <span
                key={segment.status}
                className={`stack-seg billing-${segment.status}`}
                style={{ flexGrow: segment.count }}
              />
            ))}
          </div>
          <ul className="legend-list">
            {segments.map((segment) => (
              <li key={segment.status}>
                <span className={`legend-swatch billing-${segment.status}`} aria-hidden />
                <span className="legend-label">{BILLING_STATUS_LABELS[segment.status] ?? segment.status}</span>
                <span className="legend-value num">{formatNumber(segment.count)}</span>
                <span className="legend-pct num">{Math.round((segment.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
