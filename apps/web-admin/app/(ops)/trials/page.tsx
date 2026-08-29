'use client';

import Link from 'next/link';
import { TableFilters } from '@/components/TableFilters';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { EXPIRING_OPTIONS, TRIAL_MODES, TRIAL_STATUSES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', status: '', mode: '', expiringDays: '' };

export default function TrialsPage() {
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
    endpoint: '/platform/trials',
    queryKey: 'platform-trials',
    defaultFilters: DEFAULT_FILTERS,
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Trials</h1>
      <p style={{ color: 'var(--muted)' }}>
        Checklist de activación · modos TIME (90 días) o MANUAL (sin vencimiento automático).
      </p>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar por club o ciudad…' },
          { type: 'select', key: 'status', label: 'Estado', options: TRIAL_STATUSES },
          { type: 'select', key: 'mode', label: 'Modo', options: TRIAL_MODES },
          { type: 'select', key: 'expiringDays', label: 'Vencimiento', options: EXPIRING_OPTIONS },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      {isLoading ? (
        <p>Cargando trials…</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Estado</th>
                <th>Modo</th>
                <th>Checklist</th>
                <th>Días</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No hay trials con esos filtros.
                  </td>
                </tr>
              ) : (
                items.map((row: any) => (
                  <tr key={row.clubId}>
                    <td>{row.clubName}</td>
                    <td>
                      <StatusBadge value={row.status} category="billingStatus" />
                    </td>
                    <td><StatusText value={row.trialMode} category="trialMode" fallback="—" /></td>
                    <td>
                      {row.checklist?.requiredDone}/{row.checklist?.requiredTotal}
                    </td>
                    <td>{row.daysRemaining ?? '—'}</td>
                    <td>
                      <Link href={`/clubs/${row.clubId}`} style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        Gestionar
                      </Link>
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
        </div>
      )}
    </div>
  );
}
