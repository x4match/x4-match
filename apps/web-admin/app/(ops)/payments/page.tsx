'use client';

import { TableFilters } from '@/components/TableFilters';
import { StatusText } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { PAYMENT_STATUSES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', status: '', provider: '' };

export default function PaymentsPage() {
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
    endpoint: '/platform/payments',
    queryKey: 'platform-payments',
    defaultFilters: DEFAULT_FILTERS,
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Pagos (señas)</h1>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar partido, club o ID de pago…' },
          { type: 'select', key: 'status', label: 'Estado', options: PAYMENT_STATUSES },
          { type: 'search', key: 'provider', placeholder: 'Proveedor (ej. mercadopago)' },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      {isLoading ? (
        <p>Cargando pagos…</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Partido</th>
                <th>Club</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Proveedor</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No hay pagos con esos filtros.
                  </td>
                </tr>
              ) : (
                items.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.match_title}</td>
                    <td>{p.club_name || '—'}</td>
                    <td>${Number(p.amount).toLocaleString('es-AR')}</td>
                    <td><StatusText value={p.status} category="paymentStatus" /></td>
                    <td><StatusText value={p.provider} category="provider" /></td>
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
