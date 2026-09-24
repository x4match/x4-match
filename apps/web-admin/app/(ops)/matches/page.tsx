'use client';

import Link from 'next/link';
import { TableFilters } from '@/components/TableFilters';
import { StatusText } from '@/components/StatusBadge';
import { TablePagination } from '@/components/TablePagination';
import { MATCH_STATUSES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', status: '' };

export default function MatchesPage() {
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
    endpoint: '/platform/matches',
    queryKey: 'platform-matches',
    defaultFilters: DEFAULT_FILTERS,
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Partidos</h1>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar por título o club…' },
          { type: 'select', key: 'status', label: 'Estado', options: MATCH_STATUSES },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      {isLoading ? (
        <p>Cargando partidos…</p>
      ) : (
        <div className="card card-table">
          <table className="table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Club</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No hay partidos con esos filtros.
                  </td>
                </tr>
              ) : (
                items.map((m: any) => (
                  <tr key={m.id}>
                    <td>{m.title}</td>
                    <td>{m.club_name || '—'}</td>
                    <td>
                      <StatusText value={m.status} category="matchStatus" />
                    </td>
                    <td>{new Date(m.created_at).toLocaleDateString('es-AR')}</td>
                    <td>
                      <Link
                        href={`/matches/${m.id}`}
                        style={{ color: 'var(--primary)', fontWeight: 700 }}
                      >
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
