'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, Swords, Trophy, UserRound } from 'lucide-react';
import { DetailBack, DetailHero, formatDateTime, initials } from '@/components/DetailHero';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { getStatusLabel } from '@/lib/labels';

const ACTIVE_PLAYER_STATUSES = ['JOINED', 'CONFIRMED'];

type TeamMember = { key: string; name: string; href?: string; secondary: string };

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

  const neededPlayers = Number(match.needed_players) || 0;
  const half = Math.ceil(Math.max(neededPlayers, 2) / 2);
  const activePlayers = players.filter((p: any) => ACTIVE_PLAYER_STATUSES.includes(p.player_status));
  const occupied = activePlayers.length + guests.length;
  const occupiedPct = neededPlayers ? Math.min(100, Math.round((occupied / neededPlayers) * 100)) : 0;

  const members: (TeamMember & { slot: number | null })[] = [
    ...activePlayers.map((p: any) => ({
      key: `p-${p.user_id}`,
      name: p.name,
      href: `/users/${p.user_id}`,
      secondary: p.rating != null ? `Rating ${p.rating}` : 'Sin rating',
      slot: p.slot_order ?? null,
    })),
    ...guests.map((g: any) => ({
      key: `g-${g.id}`,
      name: g.name,
      secondary: `Invitado · ${getStatusLabel('guestRole', g.role)}`,
      slot: g.slot_order ?? null,
    })),
  ].sort((a, b) => (a.slot ?? 999) - (b.slot ?? 999));

  const teams: { id: 'A' | 'B'; members: TeamMember[] }[] = [
    { id: 'A', members: members.filter((m) => m.slot != null && m.slot <= half) },
    { id: 'B', members: members.filter((m) => m.slot != null && m.slot > half) },
  ];
  const unassigned = members.filter((m) => m.slot == null);
  const winner = String(result?.winner_team ?? '').toUpperCase();
  const score = result
    ? typeof result.score === 'object'
      ? JSON.stringify(result.score)
      : result.score || null
    : null;

  return (
    <div>
      <DetailBack href="/matches" label="Partidos" />

      <DetailHero
        title={match.title}
        avatar={<Swords size={28} aria-hidden />}
        handle={
          <>
            <StatusText value={match.mode} category="matchMode" /> ·{' '}
            <StatusText value={match.gender} category="matchGender" />
          </>
        }
        meta={[
          <>
            <CalendarDays size={14} aria-hidden /> {formatDateTime(match.date)}
          </>,
          match.club_id ? (
            <Link href={`/clubs/${match.club_id}`}>
              <Building2 size={14} aria-hidden /> {match.club_name || 'Club'}
              {match.club_city ? ` · ${match.club_city}` : ''}
            </Link>
          ) : null,
          match.created_by_user_id ? (
            <Link href={`/users/${match.created_by_user_id}`}>
              <UserRound size={14} aria-hidden /> Creado por {match.creator_name || match.creator_email}
            </Link>
          ) : null,
        ]}
        badges={
          <>
            <StatusBadge value={match.status} category="matchStatus" />
            {result ? <StatusBadge value={result.result_status} category="resultStatus" /> : null}
          </>
        }
      />

      <div className="ops-kpi-grid" style={{ marginBottom: 16 }}>
        <div className="ops-kpi meter">
          <div className="meter-head">
            <p className="ops-kpi-label">Cupos</p>
            <span className="meter-value num">
              {occupied}/{neededPlayers || '—'}
            </span>
          </div>
          <div className="meter-track">
            <span className="meter-fill" style={{ width: `${occupiedPct}%` }} />
          </div>
          <p className="meter-hint">
            {neededPlayers && occupied >= neededPlayers
              ? 'Partido completo'
              : `Faltan ${Math.max(neededPlayers - occupied, 0)} jugadores`}
          </p>
        </div>
        <div className="ops-kpi">
          <p className="ops-kpi-label">Nivel</p>
          <p className="ops-kpi-value">
            {match.level_min ?? '—'}–{match.level_max ?? '—'}
          </p>
          <p className="ops-kpi-hint">Rango de categoría</p>
        </div>
        <div className="ops-kpi">
          <p className="ops-kpi-label">Cancha</p>
          <p className="ops-kpi-value" style={{ fontFamily: 'var(--font-sans)', fontSize: 20 }}>
            <StatusText value={match.court_booking} category="courtBooking" />
          </p>
          <p className="ops-kpi-hint">{match.ends_at ? `Termina ${formatDateTime(match.ends_at)}` : 'Sin horario de fin'}</p>
        </div>
        <div className="ops-kpi">
          <p className="ops-kpi-label">Resultado</p>
          <p className="ops-kpi-value" style={{ color: score ? 'var(--primary)' : undefined, fontSize: score ? 22 : 28 }}>
            {score || '—'}
          </p>
          <p className="ops-kpi-hint">
            {result ? (winner ? `Ganó el equipo ${winner}` : 'Sin ganador') : 'Sin resultado cargado'}
          </p>
        </div>
      </div>

      <div className="ops-grid-2" style={{ marginBottom: 16 }}>
        <div className="card bento-tile">
          <div className="tile-header">
            <div>
              <h3 className="tile-title">Equipos</h3>
              <p className="tile-subtitle">Jugadores anotados e invitados según su lugar en la cancha</p>
            </div>
          </div>
          <div className="team-grid">
            {teams.map((team) => (
              <div key={team.id} className={`team-card${winner === team.id ? ' team-card--winner' : ''}`}>
                <div className="team-card-head">
                  <p className="detail-section-label" style={{ margin: 0 }}>
                    Equipo {team.id}
                  </p>
                  {winner === team.id ? (
                    <span className="badge badge-success">
                      <Trophy size={12} aria-hidden /> Ganador
                    </span>
                  ) : null}
                </div>
                <TeamMembers members={team.members} />
              </div>
            ))}
          </div>
          {unassigned.length > 0 ? (
            <div>
              <p className="detail-section-label">Sin lugar asignado</p>
              <TeamMembers members={unassigned} />
            </div>
          ) : null}
        </div>

        <div className="card bento-tile">
          <div className="tile-header">
            <div>
              <h3 className="tile-title">Detalle</h3>
              <p className="tile-subtitle">Configuración del partido</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Modo</dt>
              <dd>
                <StatusText value={match.mode} category="matchMode" />
              </dd>
            </div>
            <div>
              <dt>Género</dt>
              <dd>
                <StatusText value={match.gender} category="matchGender" />
              </dd>
            </div>
            <div>
              <dt>Inicio</dt>
              <dd>{formatDateTime(match.date)}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{formatDateTime(match.ends_at)}</dd>
            </div>
            <div>
              <dt>Reserva de cancha</dt>
              <dd>
                <StatusText value={match.court_booking} category="courtBooking" />
              </dd>
            </div>
            <div>
              <dt>Creado</dt>
              <dd>{formatDateTime(match.created_at)}</dd>
            </div>
          </dl>
          {match.venue_note ? (
            <div>
              <p className="detail-section-label">Nota del lugar</p>
              <p className="detail-bio">{match.venue_note}</p>
            </div>
          ) : null}
          {result ? (
            <div>
              <p className="detail-section-label">Resultado cargado</p>
              <p className="score-display">{score || '—'}</p>
              <p className="detail-note">
                <StatusText value={result.result_status} category="resultStatus" /> ·{' '}
                {formatDateTime(result.created_at)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card card-table">
        <div className="tile-header" style={{ padding: '16px 16px 4px' }}>
          <div>
            <h3 className="tile-title">Jugadores</h3>
            <p className="tile-subtitle">Todos los jugadores vinculados, incluidas solicitudes y bajas</p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Email</th>
              <th>Rating</th>
              <th>Estado</th>
              <th>Lugar</th>
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
                    <Link
                      href={`/users/${p.user_id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 600 }}
                    >
                      <span className="ops-avatar ops-avatar--sm" style={{ overflow: 'hidden' }}>
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          initials(p.name)
                        )}
                      </span>
                      <span style={{ color: 'var(--primary)' }}>{p.name}</span>
                    </Link>
                  </td>
                  <td>{p.email}</td>
                  <td className="num">{p.rating ?? '—'}</td>
                  <td>
                    <StatusBadge value={p.player_status} category="matchPlayerStatus" />
                  </td>
                  <td className="num">
                    {p.slot_order != null ? `${p.slot_order} · Eq. ${p.slot_order <= half ? 'A' : 'B'}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamMembers({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return <p className="detail-empty">Lugar libre.</p>;
  return (
    <ul className="recent-list">
      {members.map((m) => {
        const content = (
          <>
            <span className="ops-avatar ops-avatar--sm">{initials(m.name)}</span>
            <span className="recent-main">
              <span className="recent-name">{m.name}</span>
              <span className="recent-secondary">{m.secondary}</span>
            </span>
          </>
        );
        return (
          <li key={m.key}>
            {m.href ? (
              <Link href={m.href} className="recent-row">
                {content}
              </Link>
            ) : (
              <div className="recent-row">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
