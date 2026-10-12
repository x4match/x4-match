import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import type { MonitorTotals } from './types';

function Meter({ label, value, total, hint }: { label: string; value: number; total: number; hint: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value num">{pct}%</span>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="meter-hint">{hint}</p>
    </div>
  );
}

export function NetworkHealth({ totals }: { totals: MonitorTotals }) {
  return (
    <section className="bento-tile health-card" aria-labelledby="health-title">
      <header className="tile-header">
        <div>
          <h2 id="health-title" className="tile-title">
            Salud de la red
          </h2>
          <p className="tile-subtitle">Cobertura y conversión de clubes</p>
        </div>
      </header>

      <Meter
        label="Clubes con Mercado Pago"
        value={totals.mpConnectedClubs}
        total={totals.clubs}
        hint={`${formatNumber(totals.mpConnectedClubs)} de ${formatNumber(totals.clubs)} clubes cobran online`}
      />

      <div className="health-stats">
        <Link href="/trials" className="health-stat">
          <span className="health-stat-value num">{formatNumber(totals.activeTrials)}</span>
          <span className="health-stat-label">Trials activos</span>
        </Link>
        <Link
          href="/trials"
          className={`health-stat${totals.trialsExpiring7d > 0 ? ' health-stat--alert' : ''}`}
        >
          <span className="health-stat-value num">{formatNumber(totals.trialsExpiring7d)}</span>
          <span className="health-stat-label">Vencen en 7 días</span>
        </Link>
        <Link
          href="/club-registrations"
          className={`health-stat${totals.pendingClubRegistrations > 0 ? ' health-stat--alert' : ''}`}
        >
          <span className="health-stat-value num">{formatNumber(totals.pendingClubRegistrations)}</span>
          <span className="health-stat-label">Altas pendientes</span>
        </Link>
      </div>
    </section>
  );
}
