'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TableFilters } from '@/components/TableFilters';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { USER_ROLES } from '@/lib/filter-options';
import { useTableFilters } from '@/lib/use-table-filters';

const DEFAULT_FILTERS = { q: '', role: '' };

export default function ActivityPage() {
  const { filters, setFilter, resetFilters, hasActiveFilters } = useTableFilters(DEFAULT_FILTERS);

  const { data: monitor } = useQuery({
    queryKey: ['platform-monitor'],
    queryFn: async () => (await api.get('/platform/monitor')).data,
  });

  const filteredClubs = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return (monitor?.recentClubs ?? []).filter((c: any) => !q || c.name.toLowerCase().includes(q));
  }, [monitor, filters.q]);

  const filteredUsers = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return (monitor?.recentUsers ?? []).filter((u: any) => {
      const matchesQ = !q || u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      const matchesRole = !filters.role || u.role === filters.role;
      return matchesQ && matchesRole;
    });
  }, [monitor, filters.q, filters.role]);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Actividad</h1>
      <p style={{ color: 'var(--muted)' }}>Eventos recientes de la plataforma.</p>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar en actividad reciente…' },
          { type: 'select', key: 'role', label: 'Rol (usuarios)', options: USER_ROLES },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Altas de clubes</h3>
          {filteredClubs.length === 0 ? (
            <p className="table-empty" style={{ padding: '12px 0' }}>
              Sin resultados.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredClubs.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>
                      <StatusBadge value={c.billingStatus} category="billingStatus" />
                    </td>
                    <td>{new Date(c.createdAt).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Registros de usuarios</h3>
          {filteredUsers.length === 0 ? (
            <p className="table-empty" style={{ padding: '12px 0' }}>
              Sin resultados.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td><StatusBadge value={u.role} category="userRole" /></td>
                    <td>{new Date(u.createdAt).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
