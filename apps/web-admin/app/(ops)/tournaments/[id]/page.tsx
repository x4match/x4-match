'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-tournament', id],
    queryFn: async () => (await api.get(`/platform/tournaments/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading) return <p>Cargando torneo…</p>;
  if (error || !data) return <p>No se pudo cargar el torneo.</p>;

  const { tournament, registrations } = data;

  return (
    <div>
      <p>
        <Link href="/tournaments">← Torneos</Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{tournament.name}</h1>
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
        <StatusBadge value={tournament.status} category="tournamentStatus" />
        <span>·</span>
        <span>{tournament.category || '—'}</span>
        <span>·</span>
        <span>{tournament.format || '—'}</span>
        {tournament.club_id ? (
          <>
            <span>·</span>
            <Link href={`/clubs/${tournament.club_id}`}>{tournament.club_name || 'Club'}</Link>
          </>
        ) : null}
      </div>

      <div className="ops-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Detalle</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Inicio:{' '}
              {tournament.start_date
                ? new Date(tournament.start_date).toLocaleDateString('es-AR')
                : '—'}
            </li>
            <li>Género: {tournament.gender || '—'}</li>
            <li>Modalidad: {tournament.modality || '—'}</li>
            <li>Agenda: {tournament.schedule_type || '—'}</li>
            <li>Máx. equipos: {tournament.max_teams ?? '—'}</li>
            <li>
              Precio:{' '}
              {tournament.price != null
                ? `$${Number(tournament.price).toLocaleString('es-AR')}`
                : '—'}
            </li>
            <li>
              Organizador:{' '}
              {tournament.organizer_user_id ? (
                <Link href={`/users/${tournament.organizer_user_id}`}>
                  {tournament.organizer_name || tournament.organizer_email}
                </Link>
              ) : (
                '—'
              )}
            </li>
            <li>
              Inscripciones: {tournament.registrations_count ?? 0} (
              {tournament.confirmed_count ?? 0} confirmadas)
            </li>
            <li>Alta: {new Date(tournament.created_at).toLocaleString('es-AR')}</li>
          </ul>
          {tournament.description ? (
            <p style={{ marginTop: 12, marginBottom: 0, color: 'var(--muted)', fontSize: 14 }}>
              {tournament.description}
            </p>
          ) : null}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Resumen</h3>
          <p style={{ margin: 0 }}>
            Club: {tournament.club_name || '—'}
            {tournament.club_city ? ` · ${tournament.club_city}` : ''}
          </p>
        </div>
      </div>

      <div className="card card-table">
        <h3 style={{ marginTop: 0, padding: '0 12px' }}>Inscripciones</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Pareja</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {registrations.length === 0 ? (
              <tr>
                <td colSpan={3} className="table-empty">
                  Sin inscripciones.
                </td>
              </tr>
            ) : (
              registrations.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    {r.player1_user_id ? (
                      <Link href={`/users/${r.player1_user_id}`}>{r.player1_name}</Link>
                    ) : (
                      r.player1_name || '—'
                    )}
                    {' / '}
                    {r.player2_user_id ? (
                      <Link href={`/users/${r.player2_user_id}`}>{r.player2_name}</Link>
                    ) : (
                      r.player2_name || '—'
                    )}
                  </td>
                  <td>
                    <StatusText value={r.status} category="tournamentStatus" />
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString('es-AR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
