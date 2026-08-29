'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { getStatusLabel } from '@/lib/labels';

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

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{club.name}</h1>
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
        <span>{club.city || 'Sin ciudad'}</span>
        <span>·</span>
        <span>Plan {getStatusLabel('subscriptionPlan', club.subscription_plan, club.subscription_plan || '—')}</span>
        <span>·</span>
        <StatusBadge value={trial.status} category="billingStatus" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Billing y trial</h3>
          <p>
            Modo: <StatusText value={trial.trialMode} category="trialMode" fallback="—" />
          </p>
          <p>Días restantes: {trial.daysRemaining ?? '—'}</p>
          <p>
            Plan pago desde:{' '}
            {trial.activatedAt ? new Date(trial.activatedAt).toLocaleDateString('es-AR') : '—'}
          </p>
          <p>
            Checklist: {trial.checklist.requiredDone}/{trial.checklist.requiredTotal} requeridos
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
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

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, marginBottom: 0 }}>
            Suspender bloquea el acceso sin borrar datos. Desactivar plan vuelve el club a &quot;Sin iniciar&quot;.
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Admins</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {admins.map((a: any) => (
              <li key={a.id}>
                {a.name} · {a.email}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Mercado Pago: <StatusText value={club.mp_status || 'DISCONNECTED'} category="mpStatus" />
          </p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Checklist de activación</h3>
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
