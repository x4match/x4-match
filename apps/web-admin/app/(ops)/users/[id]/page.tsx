'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-user', id],
    queryFn: async () => (await api.get(`/platform/users/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading) return <p>Cargando usuario…</p>;
  if (error || !data) return <p>No se pudo cargar el usuario.</p>;

  const { user, player, clubsAdmin, sponsors, stats, recentMatches } = data;

  return (
    <div>
      <p>
        <Link href="/users">← Usuarios</Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{user.name}</h1>
      <div
        style={{
          color: 'var(--muted)',
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <span>{user.email}</span>
        <span>·</span>
        <StatusBadge value={user.role} category="userRole" />
        <span>·</span>
        <span>Alta {new Date(user.created_at).toLocaleDateString('es-AR')}</span>
      </div>

      <div className="ops-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Perfil jugador</h3>
          {player ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Nickname: {player.nickname || '—'}</li>
              <li>Ciudad: {player.city || '—'}</li>
              <li>Posición: {player.position || '—'}</li>
              <li>Rating: {player.rating ?? '—'}</li>
              <li>Categoría: {player.category_status || '—'}</li>
              <li>Partidos placement: {player.placement_matches_played ?? 0}</li>
              <li>Partidos jugados: {stats.matchesPlayed}</li>
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>Sin perfil de jugador.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Vínculos</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>Clubes (admin)</p>
          <ul style={{ marginTop: 0, paddingLeft: 18 }}>
            {clubsAdmin.length === 0 ? (
              <li>—</li>
            ) : (
              clubsAdmin.map((c: any) => (
                <li key={c.id}>
                  <Link href={`/clubs/${c.id}`}>{c.name}</Link>
                  {c.city ? ` · ${c.city}` : ''}
                </li>
              ))
            )}
          </ul>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Partners</p>
          <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
            {sponsors.length === 0 ? (
              <li>—</li>
            ) : (
              sponsors.map((s: any) => (
                <li key={s.id}>
                  <Link href={`/partners/${s.id}`}>{s.name}</Link> · {s.role}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="card card-table">
        <h3 style={{ marginTop: 0, padding: '0 12px' }}>Partidos recientes</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Club</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {recentMatches.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  Sin partidos.
                </td>
              </tr>
            ) : (
              recentMatches.map((m: any) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/matches/${m.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {m.title}
                    </Link>
                  </td>
                  <td>{m.club_name || '—'}</td>
                  <td>
                    <StatusText value={m.status} category="matchStatus" />
                  </td>
                  <td>{new Date(m.created_at).toLocaleDateString('es-AR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
