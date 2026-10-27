'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import { TableFilters } from '@/components/TableFilters';
import { TablePagination } from '@/components/TablePagination';
import { api } from '@/lib/api';
import { USER_ROLES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', role: '' };

type AssignableRole = 'PLAYER' | 'PARTNER' | 'SUPER_ADMIN';

const ROLE_OPTIONS: { value: AssignableRole; label: string; warning: string }[] = [
  {
    value: 'SUPER_ADMIN',
    label: 'Ops (Super admin)',
    warning: 'Va a tener acceso completo al backoffice.',
  },
  {
    value: 'PARTNER',
    label: 'Partner',
    warning: 'Podrá entrar a web-sponsors si está asignado a un partner.',
  },
  {
    value: 'PLAYER',
    label: 'Jugador',
    warning: 'Pierde los accesos de ops o partner que tuviera.',
  },
];

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

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AssignableRole }) =>
      api.patch(`/platform/users/${userId}/role`, { role }).then((r) => r.data),
    meta: {
      successMessage: 'Rol actualizado.',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-ops-users'] });
      setPendingRole(null);
    },
  });

  const [pendingRole, setPendingRole] = useState<{
    user: { id: string; name: string; email: string; role: string };
    option: (typeof ROLE_OPTIONS)[number];
  } | null>(null);

  function onRoleSelect(user: { id: string; name: string; email: string; role: string }, role: string) {
    const option = ROLE_OPTIONS.find((o) => o.value === role);
    if (!option || role === user.role) return;
    setPendingRole({ user, option });
  }

  function closeRoleModal() {
    if (!changeRole.isPending) setPendingRole(null);
  }

  function onCreateOps(e: FormEvent) {
    e.preventDefault();
    createOps.mutate();
  }

  return (
    <div>
      <div className="ops-page-header">
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

      <Modal open={pendingRole !== null} title="Confirmar cambio de rol" onClose={closeRoleModal}>
        {pendingRole ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }}>
              <strong>{pendingRole.user.name}</strong>
              <br />
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>{pendingRole.user.email}</span>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StatusBadge value={pendingRole.user.role} category="userRole" />
              <span aria-hidden>→</span>
              <StatusBadge value={pendingRole.option.value} category="userRole" />
            </div>
            <p style={{ margin: 0, color: 'var(--warning)', fontSize: 14 }}>
              {pendingRole.option.warning}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                className="btn btn-outline"
                type="button"
                onClick={closeRoleModal}
                disabled={changeRole.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={changeRole.isPending}
                onClick={() =>
                  changeRole.mutate({
                    userId: pendingRole.user.id,
                    role: pendingRole.option.value,
                  })
                }
              >
                {changeRole.isPending
                  ? 'Cambiando…'
                  : `Confirmar: ${pendingRole.option.label}`}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="card card-table">
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
                  <th>Cambiar rol</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      No hay usuarios con esos filtros.
                    </td>
                  </tr>
                ) : (
                  items.map((u: any) => (
                    <tr key={u.id}>
                      <td>
                        <Link href={`/users/${u.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {u.name}
                        </Link>
                      </td>
                      <td>{u.email}</td>
                      <td><StatusBadge value={u.role} category="userRole" /></td>
                      <td>{new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                      <td>
                        {u.role === 'SUPER_ADMIN' ? (
                          <span className="badge badge-success">Operador</span>
                        ) : (
                          <select
                            className="input"
                            style={{ width: 'auto', minWidth: 170, minHeight: 36 }}
                            aria-label={`Cambiar rol de ${u.name}`}
                            value=""
                            disabled={changeRole.isPending}
                            onChange={(e) => onRoleSelect(u, e.target.value)}
                          >
                            <option value="">Cambiar rol…</option>
                            {ROLE_OPTIONS.filter((o) => o.value !== u.role).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/users/${u.id}`} style={{ color: 'var(--primary)', fontWeight: 700 }}>
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
          </>
        )}
      </div>
    </div>
  );
}
