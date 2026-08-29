'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { TableFilters } from '@/components/TableFilters';
import { TablePagination } from '@/components/TablePagination';
import { api } from '@/lib/api';
import { USER_ROLES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', role: '' };

export default function UsersPage() {
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
    endpoint: '/platform/users',
    queryKey: 'platform-users',
    defaultFilters: DEFAULT_FILTERS,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { data: opsUsers } = useQuery({
    queryKey: ['platform-ops-users'],
    queryFn: async () => (await api.get('/platform/users/ops')).data,
  });

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  const createOps = useMutation({
    mutationFn: async () =>
      api.post('/platform/users/ops', { name, email, password }).then((r) => r.data),
    meta: {
      successMessage: 'Operador SUPER_ADMIN creado.',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-ops-users'] });
      closeModal();
    },
  });

  const promote = useMutation({
    mutationFn: async (userId: string) =>
      api.patch(`/platform/users/${userId}/role`, { role: 'SUPER_ADMIN' }).then((r) => r.data),
    meta: {
      successMessage: 'Usuario promovido a SUPER_ADMIN.',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-ops-users'] });
    },
  });

  function onCreateOps(e: FormEvent) {
    e.preventDefault();
    createOps.mutate();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Usuarios</h1>
        <button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}>
          Crear operador
        </button>
      </div>

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar por nombre o email…' },
          { type: 'select', key: 'role', label: 'Rol', options: USER_ROLES },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Operadores (SUPER_ADMIN)</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          Solo estos usuarios pueden ingresar al backoffice.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {(opsUsers ?? []).map((u: any) => (
            <li key={u.id}>
              {u.name} · {u.email}
            </li>
          ))}
        </ul>
      </div>

      <Modal open={modalOpen} title="Crear operador SUPER_ADMIN" onClose={closeModal}>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          El nuevo usuario podrá ingresar al backoffice con email y contraseña.
        </p>
        <form onSubmit={onCreateOps} style={{ display: 'grid', gap: 10 }}>
          <input
            className="input"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Contraseña (mín. 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" type="button" onClick={closeModal}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={createOps.isPending}>
              {createOps.isPending ? 'Creando…' : 'Crear operador'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 16, margin: 0 }}>Cargando usuarios…</p>
        ) : (
          <>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Alta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  No hay usuarios con esos filtros.
                </td>
              </tr>
            ) : (
              items.map((u: any) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><StatusBadge value={u.role} category="userRole" /></td>
                <td>{new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                <td>
                  {u.role !== 'SUPER_ADMIN' ? (
                    <button
                      className="btn btn-outline"
                      type="button"
                      disabled={promote.isPending}
                      onClick={() => promote.mutate(u.id)}
                    >
                      Hacer ops
                    </button>
                  ) : (
                    <span className="badge badge-success">Operador</span>
                  )}
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
