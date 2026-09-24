'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Modal } from '@/components/Modal';
import { api } from '@/lib/api';

export default function PartnersPage() {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['platform-sponsors'],
    queryFn: async () => (await api.get('/platform/shop/sponsors')).data,
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [memberUserId, setMemberUserId] = useState('');
  const [assignSponsorId, setAssignSponsorId] = useState('');

  function resetCreateForm() {
    setName('');
    setSlug('');
    setOwnerName('');
    setOwnerEmail('');
    setOwnerPassword('');
  }

  function closeModal() {
    setOpen(false);
    resetCreateForm();
  }

  const create = useMutation({
    mutationFn: async () =>
      api.post('/platform/shop/sponsors', {
        name,
        slug: slug || undefined,
        ownerName,
        ownerEmail,
        ownerPassword,
      }),
    meta: { successMessage: 'Partner creado con acceso OWNER.' },
    onSuccess: () => {
      closeModal();
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
    },
  });

  const addMember = useMutation({
    mutationFn: async () =>
      api.post(`/platform/shop/sponsors/${assignSponsorId}/members`, {
        userId: memberUserId,
        role: 'OWNER',
      }),
    meta: { successMessage: 'Usuario asignado al partner.' },
    onSuccess: () => {
      setMemberUserId('');
      setAssignSponsorId('');
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
    },
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  function onAssign(e: FormEvent) {
    e.preventDefault();
    addMember.mutate();
  }

  return (
    <div>
      <div className="ops-page-header">
        <h1 style={{ margin: 0 }}>Partners</h1>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          Nuevo partner
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Asignar usuario existente</h3>
        <form onSubmit={onAssign} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={assignSponsorId}
            onChange={(e) => setAssignSponsorId(e.target.value)}
            required
          >
            <option value="">Partner…</option>
            {(listQ.data || []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            placeholder="userId UUID"
            value={memberUserId}
            onChange={(e) => setMemberUserId(e.target.value)}
            required
            style={{ minWidth: 280 }}
          />
          <button className="btn btn-primary" type="submit" disabled={addMember.isPending}>
            {addMember.isPending ? 'Asignando…' : 'Asignar OWNER'}
          </button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 0 }}>
          Preferí crear el partner con email/contraseña abajo. Esto es para vincular un userId ya
          existente.
        </p>
      </div>

      <div className="card card-table">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Dominio</th>
              <th>Pagos</th>
              <th>Productos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(listQ.data || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  Todavía no hay partners. Creá el primero.
                </td>
              </tr>
            ) : (
              (listQ.data || []).map((s: any) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.slug}</td>
                  <td>
                    {s.custom_domain || '—'}
                    {s.custom_domain_status ? ` (${s.custom_domain_status})` : ''}
                  </td>
                  <td>
                    MP {s.mp_status || '—'} / WA {s.whatsapp_enabled ? 'sí' : 'no'}
                  </td>
                  <td>{s.products_count ?? 0}</td>
                  <td>
                    <Link
                      href={`/partners/${s.id}`}
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
      </div>

      <Modal open={open} title="Nuevo partner" onClose={closeModal}>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          Creá la marca partner y el usuario OWNER para entrar a web-sponsors.
        </p>
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Nombre del partner</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: SAC Pádel"
              required
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Slug (opcional)</span>
            <input
              className="input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="sac"
            />
          </label>
          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Acceso OWNER</p>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Nombre del responsable</span>
            <input
              className="input"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="María Gómez"
              required
              minLength={2}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Email</span>
            <input
              className="input"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="partner@email.com"
              required
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Contraseña (mín. 6)</span>
            <input
              className="input"
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" type="button" onClick={closeModal}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creando…' : 'Crear partner'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
