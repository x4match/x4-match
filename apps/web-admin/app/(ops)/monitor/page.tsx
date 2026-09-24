'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';

function StatCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: number | string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className={`ops-kpi${alert ? ' ops-kpi--alert' : ''}`}>
      <p className="ops-kpi-label">{label}</p>
      <p className="ops-kpi-value">{value}</p>
      {hint ? <p className="ops-kpi-hint">{hint}</p> : null}
    </div>
  );
}

export default function MonitorPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-monitor'],
    queryFn: async () => (await api.get('/platform/monitor')).data,
  });

  if (isLoading) {
    return <p style={{ color: 'var(--muted)' }}>Cargando monitoreo…</p>;
  }
  if (isError || !data) {
    return <p role="alert" style={{ color: '#fca5a5' }}>No se pudo cargar el monitoreo.</p>;
  }

  const t = data.totals;

  return (
    <div>
      <header className="ops-page-header">
        <div>
          <p className="ops-page-kicker">Operación en vivo</p>
          <h1 className="ops-page-title">Monitoreo</h1>
          <p className="ops-page-subtitle">
            Snapshot de la plataforma · {new Date(data.generatedAt).toLocaleString('es-AR')}
          </p>
        </div>
      </header>

      <div className="ops-kpi-grid">
        <StatCard label="Usuarios" value={t.users} />
        <StatCard label="Clubes" value={t.clubs} />
        <StatCard label="Partidos" value={t.matches} />
        <StatCard label="Torneos" value={t.tournaments} />
        <StatCard label="Trials activos" value={t.activeTrials} />
        <StatCard
          label="Trials vencen (7d)"
          value={t.trialsExpiring7d}
          hint="Requieren acción"
          alert={Number(t.trialsExpiring7d) > 0}
        />
        <StatCard label="MP conectados" value={t.mpConnectedClubs} />
      </div>

      <div className="ops-grid-2">
        <div className="card card-table">
          <div style={{ padding: '16px 16px 0' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Clubes recientes</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.recentClubs.map((c: { id: string; name: string; billingStatus: string }) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clubs/${c.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge value={c.billingStatus} category="billingStatus" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card card-table">
          <div style={{ padding: '16px 16px 0' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Usuarios recientes</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              {data.recentUsers.map((u: { id: string; name: string; role: string }) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/users/${u.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {u.name}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge value={u.role} category="userRole" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
