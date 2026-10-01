'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { TableFilters } from '@/components/TableFilters';
import { TablePagination } from '@/components/TablePagination';
import { api } from '@/lib/api';
import { VERIFICATION_STATUSES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', status: 'PENDING' };

const PROVIDER_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  GOOGLE: 'Google',
  APPLE: 'Apple',
};

type ClubRegistration = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  verification_reviewed_at?: string | null;
  verification_notes?: string | null;
  reviewed_by_name?: string | null;
  auth_provider: 'EMAIL' | 'GOOGLE' | 'APPLE';
  clubs: { id: string; name: string; city?: string | null }[];
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClubRegistrationsPage() {
  const queryClient = useQueryClient();
  const {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    items,
    total,
    page,
    setPage,
    pageSize,
    isLoading,
    errorMessage,
  } = usePaginatedPlatformList({
    endpoint: '/platform/club-registrations',
    queryKey: 'platform-club-registrations',
    defaultFilters: DEFAULT_FILTERS,
  });
  const [rejecting, setRejecting] = useState<ClubRegistration | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-club-registrations'] });
    queryClient.invalidateQueries({ queryKey: ['platform-club-registrations-pending'] });
    queryClient.invalidateQueries({ queryKey: ['platform-users'] });
  };

  const approve = useMutation({
    mutationFn: async (userId: string) =>
      api.post(`/platform/club-registrations/${userId}/approve`, {}).then((r) => r.data),
    meta: { successMessage: 'Club aprobado. Ya puede ingresar.' },
    onSuccess: refresh,
  });

  const reject = useMutation({
    mutationFn: async ({ userId, notes }: { userId: string; notes: string }) =>
      api
        .post(`/platform/club-registrations/${userId}/reject`, { notes: notes || undefined })
        .then((r) => r.data),
    meta: { successMessage: 'Registro rechazado.' },
    onSuccess: () => {
      refresh();
      closeReject();
    },
  });

  function closeReject() {
    setRejecting(null);
    setRejectNotes('');
  }

  function onReject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    reject.mutate({ userId: rejecting.id, notes: rejectNotes.trim() });
  }

  const rows = items as ClubRegistration[];

  return (
    <div>
      <div className="ops-page-header">
        <div>
          <h1 style={{ margin: 0 }}>Altas de clubes</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            Los clubes nuevos no pueden ingresar a la app ni al panel hasta que los apruebes.
          </p>
        </div>
      </div>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar por nombre o email…' },
          { type: 'select', key: 'status', label: 'Estado', options: VERIFICATION_STATUSES },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      <Modal open={!!rejecting} title="Rechazar registro" onClose={closeReject}>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          {rejecting?.name} ({rejecting?.email}) no va a poder ingresar. Podés dejar un motivo
          interno.
        </p>
        <form onSubmit={onReject} style={{ display: 'grid', gap: 10 }}>
          <textarea
            className="input"
            placeholder="Motivo (opcional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" type="button" onClick={closeReject}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={reject.isPending}>
              {reject.isPending ? 'Rechazando…' : 'Rechazar'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="card card-table">
        {isLoading ? (
          <p style={{ padding: 16, margin: 0 }}>Cargando registros…</p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Club / responsable</th>
                  <th>Email</th>
                  <th>Ingreso</th>
                  <th>Sedes</th>
                  <th>Alta</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {filters.status === 'PENDING'
                        ? 'No hay clubes pendientes de verificación.'
                        : 'No hay registros con esos filtros.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          href={`/users/${r.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 600 }}
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td>{r.email}</td>
                      <td>{PROVIDER_LABELS[r.auth_provider] ?? r.auth_provider}</td>
                      <td>
                        {r.clubs.length === 0
                          ? '—'
                          : r.clubs.map((c) => (
                              <div key={c.id}>
                                <Link href={`/clubs/${c.id}`} style={{ color: 'var(--primary)' }}>
                                  {c.name}
                                </Link>
                                {c.city ? ` · ${c.city}` : ''}
                              </div>
                            ))}
                      </td>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>
                        <StatusBadge value={r.verification_status} category="verificationStatus" />
                        {r.verification_status !== 'PENDING' ? (
                          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                            {formatDateTime(r.verification_reviewed_at)}
                            {r.reviewed_by_name ? ` · ${r.reviewed_by_name}` : ''}
                            {r.verification_notes ? (
                              <div style={{ marginTop: 2 }}>{r.verification_notes}</div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {r.verification_status !== 'APPROVED' ? (
                            <button
                              className="btn btn-primary"
                              type="button"
                              disabled={approve.isPending}
                              onClick={() => approve.mutate(r.id)}
                            >
                              Aprobar
                            </button>
                          ) : null}
                          {r.verification_status !== 'REJECTED' ? (
                            <button
                              className="btn btn-outline"
                              type="button"
                              disabled={reject.isPending}
                              onClick={() => setRejecting(r)}
                            >
                              Rechazar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}
