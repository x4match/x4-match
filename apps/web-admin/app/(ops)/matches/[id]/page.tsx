'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-match', id],
    queryFn: async () => (await api.get(`/platform/matches/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading) return <p>Cargando partido…</p>;
  if (error || !data) return <p>No se pudo cargar el partido.</p>;

  const { match, players, guests, result } = data;

  return (
    <div>
      <p>
        <Link href="/matches">← Partidos</Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{match.title}</h1>
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
        <StatusBadge value={match.status} category="matchStatus" />
        <span>·</span>
        <span>{match.mode || '—'}</span>
        <span>·</span>
        <span>{match.gender || '—'}</span>
        {match.club_id ? (
          <>
            <span>·</span>
            <Link href={`/clubs/${match.club_id}`}>{match.club_name || 'Club'}</Link>
          </>
        ) : null}
      </div>

      <div className="ops-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Detalle</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Fecha:{' '}
              {match.date
                ? new Date(match.date).toLocaleString('es-AR')
                : '—'}
            </li>
            <li>
              Fin:{' '}
              {match.ends_at
                ? new Date(match.ends_at).toLocaleString('es-AR')
                : '—'}
            </li>
            <li>
              Nivel: {match.level_min ?? '—'} – {match.level_max ?? '—'}
            </li>
            <li>Cupos: {match.needed_players ?? '—'}</li>
            <li>Reserva cancha: {match.court_booking || '—'}</li>
            {match.venue_note ? <li>Nota: {match.venue_note}</li> : null}
            <li>
              Creador:{' '}
              {match.created_by_user_id ? (
                <Link href={`/users/${match.created_by_user_id}`}>
                  {match.creator_name || match.creator_email}
                </Link>
              ) : (
                '—'
              )}
            </li>
            <li>Alta: {new Date(match.created_at).toLocaleString('es-AR')}</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Resultado</h3>
          {result ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                Estado: <StatusText value={result.result_status} category="matchStatus" />
              </li>
              <li>Ganador: {result.winner_team ?? '—'}</li>
              <li>
                Score:{' '}
                {typeof result.score === 'object'
                  ? JSON.stringify(result.score)
                  : result.score || '—'}
              </li>
            </ul>
          ) : (
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>Sin resultado cargado.</p>
          )}
        </div>
      </div>

      <div className="card card-table" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, padding: '0 12px' }}>Jugadores</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rating</th>
              <th>Estado</th>
              <th>Slot</th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  Sin jugadores.
                </td>
              </tr>
            ) : (
              players.map((p: any) => (
                <tr key={p.user_id}>
                  <td>
                    <Link href={`/users/${p.user_id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.email}</td>
                  <td>{p.rating ?? '—'}</td>
                  <td>{p.player_status}</td>
                  <td>{p.slot_order ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {guests.length > 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Invitados</h3>
          <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
            {guests.map((g: any) => (
              <li key={g.id}>
                {g.name} · {g.role} · slot {g.slot_order ?? '—'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
