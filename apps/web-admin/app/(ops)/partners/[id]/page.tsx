'use client';

import { FormEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const sponsorsQ = useQuery({
    queryKey: ['platform-sponsors'],
    queryFn: async () => (await api.get('/platform/shop/sponsors')).data,
  });
  const membersQ = useQuery({
    queryKey: ['platform-sponsor-members', id],
    queryFn: async () => (await api.get(`/platform/shop/sponsors/${id}/members`)).data,
  });
  const ordersQ = useQuery({
    queryKey: ['platform-sponsor-orders', id],
    queryFn: async () => (await api.get(`/platform/shop/sponsors/${id}/orders`)).data,
  });
  const sponsor = (sponsorsQ.data || []).find((s: any) => s.id === id);
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');

  const patch = useMutation({
    mutationFn: async () => api.patch(`/platform/shop/sponsors/${id}`, { name: name || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-sponsors'] }),
  });

  const setDomainMut = useMutation({
    mutationFn: async () => api.post(`/platform/shop/sponsors/${id}/domain`, { domain }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-sponsors'] }),
  });

  const verifyDomain = useMutation({
    mutationFn: async () => api.post(`/platform/shop/sponsors/${id}/domain/verify`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-sponsors'] }),
  });

  if (!sponsor) return <div>Cargando partner…</div>;

  return (
    <div>
      <p>
        <Link href="/partners">← Partners</Link>
      </p>
      <h1>{sponsor.name}</h1>
      <p style={{ color: 'var(--muted)' }}>
        slug <code>{sponsor.slug}</code> ·{' '}
        <a href={sponsor.store_url} target="_blank" rel="noreferrer">
          {sponsor.store_url}
        </a>
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Editar</h3>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            patch.mutate();
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            placeholder={sponsor.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">
            Guardar nombre
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Dominio</h3>
        <p>
          {sponsor.custom_domain || 'Sin dominio'} ({sponsor.custom_domain_status})
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setDomainMut.mutate();
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          <input
            placeholder="tienda.ejemplo.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit">
            Set dominio
          </button>
          <button className="btn btn-outline" type="button" onClick={() => verifyDomain.mutate()}>
            Verificar
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Miembros</h3>
        <ul>
          {(membersQ.data || []).map((m: any) => (
            <li key={m.id}>
              {m.name} · {m.email} · {m.role}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Pedidos recientes</h3>
        <ul>
          {(ordersQ.data || []).slice(0, 20).map((o: any) => (
            <li key={o.id}>
              {o.buyer_name || o.guest_name} · ${Number(o.total).toLocaleString('es-AR')} · {o.status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
