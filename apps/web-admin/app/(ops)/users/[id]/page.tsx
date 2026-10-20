'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, CalendarDays, ChevronRight, Handshake, Mail, MapPin } from 'lucide-react';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';

const PLACEMENT_MATCHES_REQUIRED = 5;

function initials(name?: string | null) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
  const placementPlayed = Math.min(player?.placement_matches_played ?? 0, PLACEMENT_MATCHES_REQUIRED);
  const placementPct = Math.round((placementPlayed / PLACEMENT_MATCHES_REQUIRED) * 100);

  return (
    <div>
      <div className="detail-back">
        <Link href="/users" className="tile-link">
          <ArrowLeft size={14} aria-hidden /> Usuarios
        </Link>
      </div>

      <section className="card detail-hero">
        <span className="ops-avatar detail-avatar">
          {player?.photo_url ? <img src={player.photo_url} alt="" /> : initials(user.name)}
        </span>
        <div className="detail-hero-main">
          <h1 className="detail-hero-title">{user.name}</h1>
          {player?.nickname ? <p className="detail-hero-handle">@{player.nickname}</p> : null}
          <ul className="detail-meta">
            <li>
              <Mail size={14} aria-hidden /> {user.email}
            </li>
            {player?.city ? (
              <li>
                <MapPin size={14} aria-hidden /> {player.city}
              </li>
            ) : null}
            <li>
              <CalendarDays size={14} aria-hidden /> Alta {formatDate(user.created_at)}
            </li>
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge value={user.role} category="userRole" />
          {player ? <StatusBadge value={player.category_status} category="categoryStatus" /> : null}
        </div>
      </section>

      {player ? (
        <div className="ops-kpi-grid" style={{ marginBottom: 16 }}>
          <div className="ops-kpi">
            <p className="ops-kpi-label">Rating</p>
            <p className="ops-kpi-value" style={{ color: 'var(--primary)' }}>
              {player.rating ?? '—'}
            </p>
            <p className="ops-kpi-hint">
              Categoría <StatusText value={player.category_status} category="categoryStatus" />
            </p>
          </div>
          <div className="ops-kpi">
            <p className="ops-kpi-label">Partidos jugados</p>
            <p className="ops-kpi-value">{stats.matchesPlayed}</p>
            <p className="ops-kpi-hint">Confirmados o anotados</p>
          </div>
          <div className="ops-kpi">
            <p className="ops-kpi-label">Posición</p>
            <p className="ops-kpi-value" style={{ fontFamily: 'var(--font-sans)', fontSize: 22 }}>
              <StatusText value={player.position} category="playerPosition" />
            </p>
            <p className="ops-kpi-hint">Lado preferido en cancha</p>
          </div>
          <div className="ops-kpi meter">
            <div className="meter-head">
              <p className="ops-kpi-label">Placement</p>
              <span className="meter-value num">
                {placementPlayed}/{PLACEMENT_MATCHES_REQUIRED}
              </span>
            </div>
            <div className="meter-track">
              <span className="meter-fill" style={{ width: `${placementPct}%` }} />
            </div>
            <p className="meter-hint">
              {placementPlayed >= PLACEMENT_MATCHES_REQUIRED
                ? 'Placement completo'
                : `Faltan ${PLACEMENT_MATCHES_REQUIRED - placementPlayed} partidos`}
            </p>
          </div>
        </div>
      ) : null}

      <div className="ops-grid-2" style={{ marginBottom: 16 }}>
        <div className="card bento-tile">
          <div className="tile-header">
            <div>
              <h3 className="tile-title">Perfil jugador</h3>
              <p className="tile-subtitle">Datos cargados por el usuario en la app</p>
            </div>
          </div>
          {player ? (
            <>
              <dl className="detail-list">
                <div>
                  <dt>Nickname</dt>
                  <dd>{player.nickname || '—'}</dd>
                </div>
                <div>
                  <dt>Ciudad</dt>
                  <dd>{player.city || '—'}</dd>
                </div>
                <div>
                  <dt>Posición</dt>
                  <dd>
                    <StatusText value={player.position} category="playerPosition" />
                  </dd>
                </div>
                <div>
                  <dt>Rating</dt>
                  <dd className="num">{player.rating ?? '—'}</dd>
                </div>
              </dl>
              <div>
                <p className="detail-section-label">Bio</p>
                <p className="detail-bio">{player.bio || 'Sin bio.'}</p>
              </div>
            </>
          ) : (
            <p className="detail-empty">Sin perfil de jugador.</p>
          )}
        </div>

        <div className="card bento-tile">
          <div className="tile-header">
            <div>
              <h3 className="tile-title">Vínculos</h3>
              <p className="tile-subtitle">Clubes que administra y partners asociados</p>
            </div>
          </div>
          <div>
            <p className="detail-section-label">Clubes (admin)</p>
            {clubsAdmin.length === 0 ? (
              <p className="detail-empty">No administra clubes.</p>
            ) : (
              <ul className="recent-list">
                {clubsAdmin.map((c: any) => (
                  <li key={c.id}>
                    <Link href={`/clubs/${c.id}`} className="recent-row">
                      <span className="ops-avatar ops-avatar--sm">
                        <Building2 size={14} aria-hidden />
                      </span>
                      <span className="recent-main">
                        <span className="recent-name">{c.name}</span>
                        <span className="recent-secondary">{c.city || 'Sin ciudad'}</span>
                      </span>
                      <ChevronRight size={16} aria-hidden style={{ color: 'var(--muted)' }} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="detail-section-label">Partners</p>
            {sponsors.length === 0 ? (
              <p className="detail-empty">Sin partners asociados.</p>
            ) : (
              <ul className="recent-list">
                {sponsors.map((s: any) => (
                  <li key={s.id}>
                    <Link href={`/partners/${s.id}`} className="recent-row">
                      <span className="ops-avatar ops-avatar--sm">
                        <Handshake size={14} aria-hidden />
                      </span>
                      <span className="recent-main">
                        <span className="recent-name">{s.name}</span>
                        <span className="recent-secondary">{s.role}</span>
                      </span>
                      <ChevronRight size={16} aria-hidden style={{ color: 'var(--muted)' }} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="card card-table">
        <div className="tile-header" style={{ padding: '16px 16px 4px' }}>
          <div>
            <h3 className="tile-title">Partidos recientes</h3>
            <p className="tile-subtitle">Últimos partidos en los que participó</p>
          </div>
        </div>
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
                  Todavía no jugó partidos.
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
                    <StatusBadge value={m.status} category="matchStatus" />
                  </td>
                  <td className="num">{formatDate(m.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
