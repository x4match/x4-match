'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Building2, CalendarDays, ChevronRight, MapPin, Phone } from 'lucide-react';
import { DetailBack, DetailHero, formatDate, initials } from '@/components/DetailHero';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';
export default function ClubDetailPage() {
  const params = useParams<{ id: string }>();
  const clubId = params.id;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['platform-club', clubId],
    queryFn: async () => (await api.get(`/platform/clubs/${clubId}`)).data,
    enabled: !!clubId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-club', clubId] });
    queryClient.invalidateQueries({ queryKey: ['platform-trials'] });
    queryClient.invalidateQueries({ queryKey: ['platform-clubs'] });
  };

  const startTrial = useMutation({
    mutationFn: (mode: 'TIME' | 'MANUAL') =>
      api.post(`/platform/clubs/${clubId}/trial/start`, { mode, trialDays: 90 }),
    meta: { successMessage: 'Trial iniciado correctamente.' },
    onSuccess: refresh,
  });

  const activatePaid = useMutation({
    mutationFn: () => api.post(`/platform/clubs/${clubId}/billing/activate`),
    meta: { successMessage: 'Plan de pago activado.' },
    onSuccess: refresh,
  });

  const deactivatePaid = useMutation({
    mutationFn: () => api.post(`/platform/clubs/${clubId}/billing/deactivate`),
    meta: { successMessage: 'Plan de pago desactivado.' },
    onSuccess: refresh,
  });

  const reactivate = useMutation({
    mutationFn: () => api.post(`/platform/clubs/${clubId}/billing/reactivate`),
    meta: { successMessage: 'Acceso del club reactivado.' },
    onSuccess: refresh,
  });

  const suspend = useMutation({
    mutationFn: () => api.post(`/platform/clubs/${clubId}/billing/suspend`, { notes: 'Suspendido desde ops' }),
    meta: { successMessage: 'Club suspendido.' },
    onSuccess: refresh,
  });

  const toggleChecklist = useMutation({
    mutationFn: ({ key, done }: { key: string; done: boolean }) =>
      api.patch(`/platform/clubs/${clubId}/trial/checklist`, { key, done }),
    meta: { successMessage: 'Checklist actualizado.' },
    onSuccess: refresh,
  });

  const savedFee = data?.club?.platform_fee_percent;
  const [feeInput, setFeeInput] = useState('');
  useEffect(() => {
    if (savedFee != null) setFeeInput(String(Number(savedFee)));
  }, [savedFee]);
  const feeValue = Number(feeInput.replace(',', '.'));
  const feeValid = feeInput.trim() !== '' && Number.isFinite(feeValue) && feeValue >= 0 && feeValue <= 30;

  const updateFee = useMutation({
    mutationFn: (platformFeePercent: number) =>
      api.patch(`/platform/clubs/${clubId}/platform-fee`, { platformFeePercent }),
    meta: { successMessage: 'Comisión actualizada.' },
    onSuccess: refresh,
  });

  if (isLoading || !data) return <p>Cargando club…</p>;

  const { club, trial, admins } = data;
  const status = trial.status as string;
  const isSuspended = status === 'SUSPENDED';
  const isActive = status === 'ACTIVE';
  const isNotStarted = status === 'NOT_STARTED';
  const hadPaidPlan = isActive || isSuspended || !!trial.activatedAt;
  const canStartTrial = isNotStarted || status === 'GRACE';
  const pending =
    startTrial.isPending ||
    activatePaid.isPending ||
    deactivatePaid.isPending ||
    reactivate.isPending ||
    suspend.isPending;

  const mpStatus = club.mp_status || 'DISCONNECTED';
  const { requiredDone, requiredTotal } = trial.checklist;
  const checklistPct = requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 0;
  const location = [club.zone, club.city].filter(Boolean).join(', ');

  return (
    <div>
      <DetailBack href="/clubs" label="Clubes" />

      <DetailHero
        title={club.name}
        avatar={club.logo_url ? <img src={club.logo_url} alt="" /> : initials(club.name)}
        meta={[
          location ? (
            <>
              <MapPin size={14} aria-hidden /> {location}
            </>
          ) : null,
          club.address ? (
            <>
              <Building2 size={14} aria-hidden /> {club.address}
            </>
          ) : null,
          club.phone ? (
            <>
              <Phone size={14} aria-hidden /> {club.phone}
            </>
          ) : null,
          club.created_at ? (
            <>
              <CalendarDays size={14} aria-hidden /> Alta {formatDate(club.created_at)}
            </>
          ) : null,
        ]}
        badges={
          <>
            <StatusBadge value={trial.status} category="billingStatus" />
            <StatusBadge value={mpStatus} category="mpStatus" />
          </>
        }
      />

      <div className="ops-kpi-grid" style={{ marginBottom: 16 }}>
        <div className="ops-kpi">
          <p className="ops-kpi-label">Estado</p>
          <p className="ops-kpi-value" style={{ fontFamily: 'var(--font-sans)', fontSize: 20 }}>
            <StatusText value={trial.status} category="billingStatus" />
          </p>
          <p className="ops-kpi-hint">
            {trial.daysRemaining != null ? `${trial.daysRemaining} días restantes` : 'Sin vencimiento'}
          </p>
        </div>
        <div className="ops-kpi meter">
          <div className="meter-head">
            <p className="ops-kpi-label">Checklist requerido</p>
            <span className="meter-value num">
              {requiredDone}/{requiredTotal}
            </span>
          </div>
          <div className="meter-track">
            <span className="meter-fill" style={{ width: `${checklistPct}%` }} />
          </div>
          <p className="meter-hint">
            {requiredDone >= requiredTotal ? 'Listo para activar' : `Faltan ${requiredTotal - requiredDone} ítems`}
          </p>
        </div>
        <div className="ops-kpi">
          <p className="ops-kpi-label">Comisión x4 Match</p>
          <p className="ops-kpi-value">{savedFee != null ? `${Number(savedFee)}%` : '—'}</p>
          <p className="ops-kpi-hint">Sobre cobros online</p>
        </div>
        <div className="ops-kpi">
          <p className="ops-kpi-label">Mercado Pago</p>
          <p className="ops-kpi-value" style={{ fontFamily: 'var(--font-sans)', fontSize: 20 }}>
            <StatusText value={mpStatus} category="mpStatus" />
          </p>
          <p className="ops-kpi-hint">
            {club.mp_connected_at ? `Desde ${formatDate(club.mp_connected_at)}` : 'Cobros online deshabilitados'}
          </p>
        </div>
      </div>

      <div className="ops-grid-2" style={{ marginBottom: 16 }}>
        <div className="card bento-tile">
          <div className="tile-header">
            <div>
              <h3 className="tile-title">Billing y trial</h3>
              <p className="tile-subtitle">Ciclo de prueba y plan de pago del club</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Modo</dt>
              <dd>
                <StatusText value={trial.trialMode} category="trialMode" fallback="—" />
              </dd>
            </div>
            <div>
              <dt>Inicio trial</dt>
              <dd>{formatDate(trial.trialStartedAt)}</dd>
            </div>
            <div>
              <dt>Fin trial</dt>
              <dd>{formatDate(trial.trialEndsAt)}</dd>
            </div>
            <div>
              <dt>Plan pago desde</dt>
              <dd>{formatDate(trial.activatedAt)}</dd>
            </div>
            {trial.graceEndsAt ? (
              <div>
                <dt>Fin de gracia</dt>
                <dd>{formatDate(trial.graceEndsAt)}</dd>
              </div>
            ) : null}
            {trial.suspendedAt ? (
              <div>
                <dt>Suspendido el</dt>
                <dd>{formatDate(trial.suspendedAt)}</dd>
              </div>
            ) : null}
          </dl>

          <div className="detail-actions">
            {canStartTrial ? (
              <>
                <button
                  className="btn btn-primary"
                  disabled={pending}
                  onClick={() => startTrial.mutate('TIME')}
                >
                  {startTrial.isPending ? 'Procesando…' : 'Iniciar trial 90d'}
                </button>
                <button
                  className="btn btn-outline"
                  disabled={pending}
                  onClick={() => startTrial.mutate('MANUAL')}
                >
                  {startTrial.isPending ? 'Procesando…' : 'Trial manual'}
                </button>
              </>
            ) : null}

            {!isActive && !isSuspended ? (
              <button className="btn btn-outline" disabled={pending} onClick={() => activatePaid.mutate()}>
                {activatePaid.isPending ? 'Procesando…' : 'Activar plan pago'}
              </button>
            ) : null}

            {hadPaidPlan && !isNotStarted ? (
              <button className="btn btn-outline" disabled={pending} onClick={() => deactivatePaid.mutate()}>
                {deactivatePaid.isPending ? 'Procesando…' : 'Desactivar plan pago'}
              </button>
            ) : null}

            {isSuspended ? (
              <button className="btn btn-primary" disabled={pending} onClick={() => reactivate.mutate()}>
                {reactivate.isPending ? 'Procesando…' : 'Reactivar acceso'}
              </button>
            ) : null}

            {!isSuspended ? (
              <button className="btn btn-danger" disabled={pending} onClick={() => suspend.mutate()}>
                {suspend.isPending ? 'Procesando…' : 'Suspender'}
              </button>
            ) : null}
          </div>

          <p className="detail-note">
            Suspender bloquea el acceso sin borrar datos. Desactivar plan vuelve el club a &quot;Sin iniciar&quot;.
          </p>
        </div>

        <div className="card bento-tile">
          <div className="tile-header">
            <div>
              <h3 className="tile-title">Admins</h3>
              <p className="tile-subtitle">Usuarios que gestionan el club</p>
            </div>
          </div>
          {admins.length === 0 ? (
            <p className="detail-empty">El club no tiene admins.</p>
          ) : (
            <ul className="recent-list">
              {admins.map((a: any) => (
                <li key={a.id}>
                  <Link href={`/users/${a.id}`} className="recent-row">
                    <span className="ops-avatar ops-avatar--sm">{initials(a.name)}</span>
                    <span className="recent-main">
                      <span className="recent-name">{a.name}</span>
                      <span className="recent-secondary">{a.email}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden style={{ color: 'var(--muted)' }} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card bento-tile" style={{ marginBottom: 16 }}>
        <div className="tile-header">
          <div>
            <h3 className="tile-title">Comisión x4 Match</h3>
            <p className="tile-subtitle">
              Porcentaje que retiene la plataforma sobre cada cobro online del club (turnos pagados con
              Mercado Pago).
            </p>
          </div>
        </div>
        <form
          style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (feeValid) updateFee.mutate(Math.round(feeValue * 100) / 100);
          }}
        >
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            max={30}
            step={0.1}
            value={feeInput}
            onChange={(e) => setFeeInput(e.target.value)}
            style={{ width: 120 }}
            aria-label="Comisión en porcentaje"
          />
          <span>%</span>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!feeValid || updateFee.isPending || feeValue === Number(savedFee ?? 0)}
          >
            {updateFee.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
        <p className="detail-note">
          Solo se aplica si el club conectó su cuenta de Mercado Pago. Entre 0% y 30%.
        </p>
      </div>

      <div className="card card-table">
        <div className="tile-header" style={{ padding: '16px 16px 4px' }}>
          <div>
            <h3 className="tile-title">Checklist de activación</h3>
            <p className="tile-subtitle">
              {requiredDone}/{requiredTotal} ítems requeridos completos
            </p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trial.checklist.items.map((item: any) => (
              <tr key={item.key}>
                <td>
                  <strong>{item.label}</strong>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.description}</div>
                </td>
                <td>{item.auto ? 'Auto' : 'Manual'}</td>
                <td>
                  <span className={`badge ${item.state.done ? 'badge-success' : 'badge-warning'}`}>
                    {item.state.done ? 'Hecho' : 'Pendiente'}
                  </span>
                </td>
                <td>
                  {!item.auto ? (
                    <button
                      className="btn btn-outline"
                      disabled={toggleChecklist.isPending}
                      onClick={() => toggleChecklist.mutate({ key: item.key, done: !item.state.done })}
                    >
                      {toggleChecklist.isPending ? '…' : item.state.done ? 'Desmarcar' : 'Marcar'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
