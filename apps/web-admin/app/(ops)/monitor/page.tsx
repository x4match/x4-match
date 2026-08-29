'use client';

import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card">
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, margin: '8px 0 4px' }}>{value}</p>
      {hint ? <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{hint}</p> : null}
    </div>
  );
}

export default function MonitorPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-monitor'],
    queryFn: async () => (await api.get('/platform/monitor')).data,
  });

  if (isLoading) return <p>Cargando monitoreo…</p>;
  if (isError || !data) return <p>No se pudo cargar el monitoreo.</p>;

  const t = data.totals;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Monitoreo</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
        Snapshot de la plataforma · {new Date(data.generatedAt).toLocaleString('es-AR')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Usuarios" value={t.users} />
        <StatCard label="Clubes" value={t.clubs} />
        <StatCard label="Partidos" value={t.matches} />
        <StatCard label="Torneos" value={t.tournaments} />
        <StatCard label="Trials activos" value={t.activeTrials} />
        <StatCard label="Trials vencen (7d)" value={t.trialsExpiring7d} hint="Requieren acción" />
        <StatCard label="MP conectados" value={t.mpConnectedClubs} />
      </div>

      <div className="ops-grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Clubes recientes</h3>
          <table className="table">
            <thead>
              <tr><th>Club</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {data.recentClubs.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><StatusBadge value={c.billingStatus} category="billingStatus" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Usuarios recientes</h3>
          <table className="table">
            <thead>
              <tr><th>Nombre</th><th>Rol</th></tr>
            </thead>
            <tbody>
              {data.recentUsers.map((u: any) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td><StatusBadge value={u.role} category="userRole" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
