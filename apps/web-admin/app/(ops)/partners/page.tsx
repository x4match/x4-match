'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
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
  const [memberUserId, setMemberUserId] = useState('');
  const [assignSponsorId, setAssignSponsorId] = useState('');

  const create = useMutation({
    mutationFn: async () =>
      api.post('/platform/shop/sponsors', { name, slug: slug || undefined }),
    onSuccess: () => {
      setOpen(false);
      setName('');
      setSlug('');
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
    },
  });

  const addMember = useMutation({
    mutationFn: async () =>
      api.post(`/platform/shop/sponsors/${assignSponsorId}/members`, {
        userId: memberUserId,
        role: 'OWNER',
      }),
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
        <h3 style={{ marginTop: 0 }}>Asignar usuario PARTNER</h3>
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
          <button className="btn btn-primary" type="submit">
            Asignar OWNER
          </button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 0 }}>
          También podés promover el rol a PARTNER desde Usuarios.
        </p>
      </div>

      <div className="card">
        <table className="ops-table">
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
            {(listQ.data || []).map((s: any) => (
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
                  <Link href={`/partners/${s.id}`}>Gestionar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="modal-backdrop">
          <form className="card" onSubmit={onCreate} style={{ maxWidth: 420, margin: '10vh auto' }}>
            <h3>Nuevo partner</h3>
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Slug (opcional)
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="sac" />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit">
                Crear
              </button>
              <button className="btn btn-outline" type="button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
