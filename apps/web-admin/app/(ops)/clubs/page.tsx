'use client';

import Link from 'next/link';
import { StatusBadge, StatusText } from '@/components/StatusBadge';
import { getStatusLabel } from '@/lib/labels';
import { TableFilters } from '@/components/TableFilters';
import { TablePagination } from '@/components/TablePagination';
import { BILLING_STATUSES, MP_STATUSES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', status: '', mpStatus: '' };

export default function ClubsPage() {
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
    endpoint: '/platform/clubs',
    queryKey: 'platform-clubs',
    defaultFilters: DEFAULT_FILTERS,
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Clubes</h1>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar por nombre o ciudad…' },
          { type: 'select', key: 'status', label: 'Billing', options: BILLING_STATUSES },
          { type: 'select', key: 'mpStatus', label: 'Mercado Pago', options: MP_STATUSES },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      {isLoading ? (
        <p>Cargando clubes…</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Ciudad</th>
                <th>Plan</th>
                <th>Billing</th>
                <th>MP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No hay clubes con esos filtros.
                  </td>
                </tr>
              ) : (
                items.map((club: any) => (
                  <tr key={club.id}>
                    <td>{club.name}</td>
                    <td>{club.city || '—'}</td>
                    <td>{getStatusLabel('subscriptionPlan', club.subscription_plan, club.subscription_plan || '—')}</td>
                    <td>
                      <StatusBadge value={club.billing_status || 'NOT_STARTED'} category="billingStatus" />
                    </td>
                    <td>
                      <StatusText value={club.mp_status} category="mpStatus" fallback="Desconectado" />
                    </td>
                    <td>
                      <Link href={`/clubs/${club.id}`} style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        Ver
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
