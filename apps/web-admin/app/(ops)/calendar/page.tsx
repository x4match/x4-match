'use client';

import { TableFilters } from '@/components/TableFilters';
import { TablePagination } from '@/components/TablePagination';
import { EXPIRING_OPTIONS, TRIAL_MODES } from '@/lib/filter-options';
import { getStatusLabel } from '@/lib/labels';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', mode: '', expiringDays: '14' };

export default function CalendarPage() {
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
    queryKey: 'platform-trials-calendar',
    defaultFilters: DEFAULT_FILTERS,
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Agenda comercial</h1>
      <p style={{ color: 'var(--muted)' }}>Trials por vencer y seguimiento de onboarding.</p>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar club…' },
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 0' }}>
          <h3 style={{ marginTop: 0 }}>
            {filters.expiringDays ? `Vencen en ≤ ${filters.expiringDays} días` : 'Trials en seguimiento'}
          </h3>
        </div>

        {isLoading ? (
          <p style={{ color: 'var(--muted)', padding: '0 16px 16px' }}>Cargando…</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '0 16px 16px' }}>Nada crítico con esos filtros.</p>
        ) : (
          <ul style={{ margin: '0 0 8px', padding: '0 16px 0 32px' }}>
            {items.map((t: any) => (
              <li key={t.clubId} style={{ marginBottom: 8 }}>
                <strong>{t.clubName}</strong>
                {t.daysRemaining != null ? ` — ${t.daysRemaining} días restantes` : ''}
                {t.trialMode ? ` (${getStatusLabel('trialMode', t.trialMode)})` : ''}
              </li>
            ))}
          </ul>
        )}

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
