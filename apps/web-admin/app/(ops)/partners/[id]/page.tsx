'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  const [catalogMode, setCatalogMode] = useState<'NATIVE' | 'EXTERNAL_LINK'>('NATIVE');
  const [externalStoreUrl, setExternalStoreUrl] = useState('');
  const [tiendaNubeStoreId, setTiendaNubeStoreId] = useState('');
  const [tiendaNubeAccessToken, setTiendaNubeAccessToken] = useState('');
  const [catalogSyncEnabled, setCatalogSyncEnabled] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    if (!sponsor) return;
    setCatalogMode(sponsor.catalog_mode === 'EXTERNAL_LINK' ? 'EXTERNAL_LINK' : 'NATIVE');
    setExternalStoreUrl(sponsor.external_store_url || sponsor.website_url || '');
    setTiendaNubeStoreId(sponsor.tienda_nube_store_id || '');
    setCatalogSyncEnabled(Boolean(sponsor.catalog_sync_enabled));
  }, [sponsor]);

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

  const saveCatalog = useMutation({
    mutationFn: async () =>
      api.patch(`/platform/shop/sponsors/${id}/external-catalog`, {
        catalogMode,
        externalStoreUrl: externalStoreUrl || null,
        tiendaNubeStoreId: tiendaNubeStoreId || null,
        tiendaNubeAccessToken: tiendaNubeAccessToken || undefined,
        catalogSyncEnabled,
      }),
    meta: { successMessage: 'Catálogo externo guardado.' },
    onSuccess: () => {
      setTiendaNubeAccessToken('');
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
    },
  });

  const syncCatalog = useMutation({
    mutationFn: async () =>
      (await api.post(`/platform/shop/sponsors/${id}/external-catalog/sync`)).data,
    meta: { successMessage: 'Sincronización completada.' },
    onSuccess: (data) => {
      setSyncResult(
        `OK · ${data.upserted} productos · método ${data.method}${
          data.store_url ? ` · ${data.store_url}` : ''
        }`,
      );
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
    },
  });

  if (!sponsor) return <div>Cargando partner…</div>;

  const lastSync = sponsor.catalog_synced_at
    ? new Date(sponsor.catalog_synced_at).toLocaleString('es-AR', {
        timeZone: 'America/Buenos_Aires',
      })
    : null;

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
        <h3>Catálogo Tienda Nube (sin cargar productos a mano)</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Mostramos el catálogo en la app y al tocar un producto abrimos la tienda del partner.
          Preferible: URL pública de la tienda. Opcional: store ID + access token de la API para un
          sync más fiable.
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            saveCatalog.mutate();
          }}
          style={{ display: 'grid', gap: 10, maxWidth: 560 }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            Modo de catálogo
            <select
              value={catalogMode}
              onChange={(e) => setCatalogMode(e.target.value as 'NATIVE' | 'EXTERNAL_LINK')}
            >
              <option value="NATIVE">Nativo (panel x4)</option>
              <option value="EXTERNAL_LINK">Externo (Tienda Nube / deep link)</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            URL de la tienda
            <input
              placeholder="https://su-marca.mitiendanube.com"
              value={externalStoreUrl}
              onChange={(e) => setExternalStoreUrl(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Store ID Tienda Nube (opcional)
            <input
              placeholder="123456"
              value={tiendaNubeStoreId}
              onChange={(e) => setTiendaNubeStoreId(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Access token API (opcional)
            <input
              type="password"
              placeholder={
                sponsor.tienda_nube_connected ? '•••••••• (ya conectado)' : 'Bearer token'
              }
              value={tiendaNubeAccessToken}
              onChange={(e) => setTiendaNubeAccessToken(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={catalogSyncEnabled}
              onChange={(e) => setCatalogSyncEnabled(e.target.checked)}
            />
            Re-sincronizar automáticamente cada 6 h
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="submit" disabled={saveCatalog.isPending}>
              Guardar catálogo
            </button>
            <button
              className="btn btn-outline"
              type="button"
              disabled={syncCatalog.isPending}
              onClick={() => syncCatalog.mutate()}
            >
              {syncCatalog.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </div>
        </form>
        <p style={{ marginTop: 12, color: 'var(--muted)' }}>
          Modo actual: <code>{sponsor.catalog_mode || 'NATIVE'}</code>
          {' · '}
          productos activos: {sponsor.active_products_count ?? sponsor.products_count ?? 0}
          {lastSync ? ` · último sync (AR): ${lastSync}` : ''}
          {sponsor.tienda_nube_connected ? ' · API conectada' : ''}
        </p>
        {sponsor.catalog_sync_error ? (
          <p style={{ color: 'crimson' }}>Error: {sponsor.catalog_sync_error}</p>
        ) : null}
        {syncResult ? <p style={{ color: 'var(--muted)' }}>{syncResult}</p> : null}
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
