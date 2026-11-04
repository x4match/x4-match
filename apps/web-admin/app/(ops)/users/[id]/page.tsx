'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronRight,
  Handshake,
  Mail,
  MapPin,
} from 'lucide-react';
import {
  DetailBack,
  DetailHero,
  formatDate,
  formatDateTime,
  initials,
} from '@/components/DetailHero';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';

const PLACEMENT_MATCHES_REQUIRED = 5;

const PLAYER_ROLES = new Set(['PLAYER', 'ORGANIZER']);

const AUTH_PROVIDER_LABELS: Record<string, string> = {
  EMAIL: 'Email y contraseña',
  GOOGLE: 'Google',
  APPLE: 'Apple',
};

const NO_CLUB_DETAIL: Record<string, string> = {
  PENDING:
    'Se registró pero todavía no tiene club cargado. Si aprobás el alta va a poder crearlo desde el panel.',
  APPROVED: 'Está aprobado pero nunca creó su club. Contactalo para completar el alta.',
  REJECTED: 'El registro fue rechazado y no tiene club cargado.',
};

type UserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
    updated_at: string;
    auth_provider: string;
    email_verified_at?: string | null;
    verification_status?: string | null;
    verification_reviewed_at?: string | null;
    verification_reviewed_by_name?: string | null;
    verification_notes?: string | null;
  };
  player: any;
  clubsAdmin: {
    id: string;
    name: string;
    city?: string | null;
    created_at: string;
    billing_status?: string | null;
  }[];
  sponsors: { id: string; name: string; role: string }[];
  stats: { matchesPlayed: number };
  recentMatches: any[];
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-user', id],
    queryFn: async () => (await api.get(`/platform/users/${id}`)).data as UserDetail,
    enabled: !!id,
  });

  if (isLoading) return <p>Cargando usuario…</p>;
  if (error || !data) return <p>No se pudo cargar el usuario.</p>;

  const { user, player, clubsAdmin, sponsors, stats, recentMatches } = data;
  const isPlayerView = PLAYER_ROLES.has(user.role);
  const isClubAdmin = user.role === 'CLUB_ADMIN';
  const clubAdminWithoutClub = isClubAdmin && clubsAdmin.length === 0;

  return (
    <div>
      <DetailBack href="/users" label="Usuarios" />

      <DetailHero
        title={user.name}
        avatar={player?.photo_url ? <img src={player.photo_url} alt="" /> : initials(user.name)}
        handle={isPlayerView && player?.nickname ? `@${player.nickname}` : null}
        meta={[
          <>
            <Mail size={14} aria-hidden /> {user.email}
          </>,
          isPlayerView && player?.city ? (
            <>
              <MapPin size={14} aria-hidden /> {player.city}
            </>
          ) : null,
          <>
            <CalendarDays size={14} aria-hidden /> Alta {formatDate(user.created_at)}
          </>,
        ]}
        badges={
          <>
            <StatusBadge value={user.role} category="userRole" />
            {isPlayerView && player ? (
              <StatusBadge value={player.category_status} category="categoryStatus" />
            ) : null}
            {isClubAdmin ? (
              <StatusBadge value={user.verification_status} category="verificationStatus" />
            ) : null}
            {clubAdminWithoutClub ? <span className="badge badge-warning">Sin club</span> : null}
          </>
        }
      />

      {clubAdminWithoutClub ? (
        <section className="action-center" aria-label="Alerta">
          <div className="action-item action-item--warning" role="status">
            <span className="action-item-icon" aria-hidden>
              <AlertTriangle size={18} />
            </span>
            <span className="action-item-text">
              <span className="action-item-title">Este admin de club no creó ningún club</span>
              <span className="action-item-detail">
                {NO_CLUB_DETAIL[user.verification_status ?? ''] ??
                  'Todavía no tiene ningún club cargado.'}
              </span>
            </span>
            {user.verification_status === 'PENDING' ? (
              <Link href="/club-registrations" className="tile-link">
                Ver altas
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {isPlayerView ? (
        <PlayerSections player={player} stats={stats} clubsAdmin={clubsAdmin} sponsors={sponsors} />
      ) : (
        <AccountSections user={user} clubsAdmin={clubsAdmin} sponsors={sponsors} />
      )}

      {isPlayerView || recentMatches.length > 0 ? (
        <RecentMatches matches={recentMatches} />
      ) : null}
    </div>
  );
}

function PlayerSections({
  player,
  stats,
  clubsAdmin,
  sponsors,
}: Pick<UserDetail, 'player' | 'stats' | 'clubsAdmin' | 'sponsors'>) {
  const placementPlayed = Math.min(player?.placement_matches_played ?? 0, PLACEMENT_MATCHES_REQUIRED);
  const placementPct = Math.round((placementPlayed / PLACEMENT_MATCHES_REQUIRED) * 100);

  return (
    <>
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
                {clubsAdmin.map((c) => (
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
                {sponsors.map((s) => (
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
    </>
  );
}

function AccountSections({
  user,
  clubsAdmin,
  sponsors,
}: Pick<UserDetail, 'user' | 'clubsAdmin' | 'sponsors'>) {
  const isClubAdmin = user.role === 'CLUB_ADMIN';
  const showSponsors = user.role === 'PARTNER' || sponsors.length > 0;

  return (
    <>
      {isClubAdmin ? (
        <div className="ops-kpi-grid" style={{ marginBottom: 16 }}>
          <div className="ops-kpi">
            <p className="ops-kpi-label">Clubes</p>
            <p
              className="ops-kpi-value"
              style={{ color: clubsAdmin.length === 0 ? 'var(--warning)' : 'var(--primary)' }}
            >
              {clubsAdmin.length}
            </p>
            <p className="ops-kpi-hint">
              {clubsAdmin.length === 0 ? 'Todavía no creó ninguno' : 'Sedes que administra'}
            </p>
          </div>
          <div className="ops-kpi">
            <p className="ops-kpi-label">Alta del club</p>
            <p className="ops-kpi-value" style={{ fontFamily: 'var(--font-sans)', fontSize: 22 }}>
              <StatusText value={user.verification_status} category="verificationStatus" />
            </p>
            <p className="ops-kpi-hint">
              {user.verification_reviewed_at
                ? `Revisada ${formatDate(user.verification_reviewed_at)}`
                : 'Sin revisar'}
            </p>
          </div>
          <div className="ops-kpi">
            <p className="ops-kpi-label">Email</p>
            <p className="ops-kpi-value" style={{ fontFamily: 'var(--font-sans)', fontSize: 22 }}>
              {user.email_verified_at ? 'Verificado' : 'Sin verificar'}
            </p>
            <p className="ops-kpi-hint">
              {user.email_verified_at
                ? formatDate(user.email_verified_at)
                : 'No ingresó el código del mail'}
            </p>
          </div>
          <div className="ops-kpi">
            <p className="ops-kpi-label">Ingreso</p>
            <p className="ops-kpi-value" style={{ fontFamily: 'var(--font-sans)', fontSize: 22 }}>
              {AUTH_PROVIDER_LABELS[user.auth_provider] ?? user.auth_provider}
            </p>
            <p className="ops-kpi-hint">Método de inicio de sesión</p>
          </div>
        </div>
      ) : null}

      <div className={isClubAdmin || showSponsors ? 'ops-grid-2' : undefined} style={{ marginBottom: 16 }}>
        <div className="card bento-tile">
          <div className="tile-header">
            <div>
              <h3 className="tile-title">Cuenta</h3>
              <p className="tile-subtitle">Acceso y estado del usuario</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Rol</dt>
              <dd>
                <StatusText value={user.role} category="userRole" />
              </dd>
            </div>
            <div>
              <dt>Ingreso</dt>
              <dd>{AUTH_PROVIDER_LABELS[user.auth_provider] ?? user.auth_provider}</dd>
            </div>
            <div>
              <dt>Email verificado</dt>
              <dd>{user.email_verified_at ? formatDateTime(user.email_verified_at) : 'No'}</dd>
            </div>
            <div>
              <dt>Última actualización</dt>
              <dd>{formatDateTime(user.updated_at)}</dd>
            </div>
            {isClubAdmin ? (
              <>
                <div>
                  <dt>Alta del club</dt>
                  <dd>
                    <StatusText value={user.verification_status} category="verificationStatus" />
                  </dd>
                </div>
                <div>
                  <dt>Revisada por</dt>
                  <dd>
                    {user.verification_reviewed_at
                      ? `${user.verification_reviewed_by_name ?? '—'} · ${formatDateTime(user.verification_reviewed_at)}`
                      : '—'}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          {isClubAdmin && user.verification_notes ? (
            <div>
              <p className="detail-section-label">Notas de revisión</p>
              <p className="detail-bio">{user.verification_notes}</p>
            </div>
          ) : null}
        </div>

        {isClubAdmin || showSponsors ? (
          <div className="card bento-tile">
            <div className="tile-header">
              <div>
                <h3 className="tile-title">{isClubAdmin ? 'Clubes que administra' : 'Partners'}</h3>
                <p className="tile-subtitle">
                  {isClubAdmin ? 'Sedes vinculadas a esta cuenta' : 'Partners asociados'}
                </p>
              </div>
            </div>
            {isClubAdmin ? (
              clubsAdmin.length === 0 ? (
                <p className="detail-empty">Todavía no creó ningún club.</p>
              ) : (
                <ul className="recent-list">
                  {clubsAdmin.map((c) => (
                    <li key={c.id}>
                      <Link href={`/clubs/${c.id}`} className="recent-row">
                        <span className="ops-avatar ops-avatar--sm">
                          <Building2 size={14} aria-hidden />
                        </span>
                        <span className="recent-main">
                          <span className="recent-name">{c.name}</span>
                          <span className="recent-secondary">
                            {c.city || 'Sin ciudad'} · Alta {formatDate(c.created_at)}
                          </span>
                        </span>
                        <StatusBadge value={c.billing_status ?? 'NOT_STARTED'} category="billingStatus" />
                        <ChevronRight size={16} aria-hidden style={{ color: 'var(--muted)' }} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {showSponsors ? (
              <div>
                {isClubAdmin ? <p className="detail-section-label">Partners</p> : null}
                {sponsors.length === 0 ? (
                  <p className="detail-empty">Sin partners asociados.</p>
                ) : (
                  <ul className="recent-list">
                    {sponsors.map((s) => (
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
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function RecentMatches({ matches }: { matches: any[] }) {
  return (
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
          {matches.length === 0 ? (
            <tr>
              <td colSpan={4} className="table-empty">
                Todavía no jugó partidos.
              </td>
            </tr>
          ) : (
            matches.map((m) => (
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
  );
}
