'use client';

import { TableFilters } from '@/components/TableFilters';
import { StatusText } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { TOURNAMENT_STATUSES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', status: '' };

export default function TournamentsPage() {
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
    endpoint: '/platform/tournaments',
    queryKey: 'platform-tournaments',
    defaultFilters: DEFAULT_FILTERS,
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Torneos</h1>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar por nombre o club…' },
          { type: 'select', key: 'status', label: 'Estado', options: TOURNAMENT_STATUSES },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      {isLoading ? (
        <p>Cargando torneos…</p>
      ) : (
        <div className="card card-table">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Club</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No hay torneos con esos filtros.
                  </td>
                </tr>
              ) : (
                items.map((t: any) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.club_name || '—'}</td>
                    <td><StatusText value={t.status} category="tournamentStatus" /></td>
                    <td>{new Date(t.created_at).toLocaleDateString('es-AR')}</td>
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
