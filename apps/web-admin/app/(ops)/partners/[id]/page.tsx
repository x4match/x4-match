'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
  const [deleteConfirm, setDeleteConfirm] = useState('');

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

  const removeDomain = useMutation({
    mutationFn: async () => api.delete(`/platform/shop/sponsors/${id}/domain`),
    meta: { successMessage: 'Dominio quitado.' },
    onSuccess: () => {
      setDomain('');
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) =>
      api.patch(`/platform/shop/sponsors/${id}`, { active }),
    meta: { successMessage: 'Estado de la tienda actualizado.' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-sponsors'] }),
  });

  const deleteSponsor = useMutation({
    mutationFn: async () => api.delete(`/platform/shop/sponsors/${id}`),
    meta: { successMessage: 'Partner eliminado.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
      router.push('/partners');
    },
  });

  const persistCatalog = () =>
    api.patch(`/platform/shop/sponsors/${id}/external-catalog`, {
      catalogMode,
      externalStoreUrl: externalStoreUrl.trim() || null,
      tiendaNubeStoreId: tiendaNubeStoreId.trim() || null,
      tiendaNubeAccessToken: tiendaNubeAccessToken.trim() || undefined,
      catalogSyncEnabled,
    });

  const saveCatalog = useMutation({
    mutationFn: persistCatalog,
    meta: { successMessage: 'Catálogo externo guardado.' },
    onSuccess: () => {
      setTiendaNubeAccessToken('');
      qc.invalidateQueries({ queryKey: ['platform-sponsors'] });
    },
  });

  const syncCatalog = useMutation({
    mutationFn: async () => {
      await persistCatalog();
      return (await api.post(`/platform/shop/sponsors/${id}/external-catalog/sync`)).data;
    },
    meta: { successMessage: 'Sincronización completada.' },
    onSettled: () => qc.invalidateQueries({ queryKey: ['platform-sponsors'] }),
    onSuccess: (data) => {
      setTiendaNubeAccessToken('');
      setSyncResult(
        `OK · ${data.upserted} productos · método ${data.method}${data.store_url ? ` · ${data.store_url}` : ''
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
  const isActive = sponsor.active !== false;
  const isExternalCatalog = sponsor.catalog_mode === 'EXTERNAL_LINK';

  return (
    <div>
      <p>
        <Link href="/partners">← Partners</Link>
      </p>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {sponsor.name}
        <span className={`badge ${isActive ? 'badge-success' : 'badge-warning'}`}>
          {isActive ? 'Activa' : 'Pausada'}
        </span>
      </h1>
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
          style={{ display: 'flex', gap: 8, marginTop: 12 }}
        >
          <input
            className="input"
            style={{ flex: 1, width: 'auto' }}
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
        <h3>Estado de la tienda</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          {isActive
            ? 'La tienda está visible: sus productos aparecen en la app y en web-sponsors.'
            : 'La tienda está pausada: sus productos no se muestran, no recibe pedidos y no se sincroniza el catálogo. Podés reactivarla cuando quieras.'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {isActive ? (
            <button
              className="btn btn-outline"
              type="button"
              disabled={toggleActive.isPending}
              onClick={() => {
                if (window.confirm(`¿Pausar la tienda de "${sponsor.name}"?`)) {
                  toggleActive.mutate(false);
                }
              }}
            >
              {toggleActive.isPending ? 'Pausando…' : 'Pausar tienda'}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              disabled={toggleActive.isPending}
              onClick={() => toggleActive.mutate(true)}
            >
              {toggleActive.isPending ? 'Reactivando…' : 'Reactivar tienda'}
            </button>
          )}
          {sponsor.store_url ? (
            <a className="btn btn-ghost" href={sponsor.store_url} target="_blank" rel="noreferrer">
              Ver tienda
            </a>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Catálogo Tienda Nube (sin cargar productos a mano)</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Mostramos el catálogo en la app y al tocar un producto abrimos la tienda del partner.
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
              className="input"
              value={catalogMode}
              onChange={(e) => setCatalogMode(e.target.value as 'NATIVE' | 'EXTERNAL_LINK')}
            >
              <option value="NATIVE">Nativo (panel x4)</option>
              <option value="EXTERNAL_LINK">Externo (Tienda Nube / deep link)</option>
            </select>
          </label>
          {catalogMode === 'EXTERNAL_LINK' && !isExternalCatalog && sponsor.custom_domain ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--warning)' }}>
              Al guardar en modo externo se quita el dominio {sponsor.custom_domain}: la tienda
              vive en su propio sitio.
            </p>
          ) : null}
          <label style={{ display: 'grid', gap: 4 }}>
            URL de la tienda
            <input
              className="input"
              placeholder="https://su-marca.mitiendanube.com"
              value={externalStoreUrl}
              onChange={(e) => setExternalStoreUrl(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Store ID Tienda Nube (opcional)
            <input
              className="input"
              name="tienda-nube-store-id"
              inputMode="numeric"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              placeholder="123456"
              value={tiendaNubeStoreId}
              onChange={(e) => setTiendaNubeStoreId(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Access token API (opcional)
            <input
              className="input"
              type="password"
              placeholder={
                sponsor.tienda_nube_connected ? '•••••••• (ya conectado)' : 'Bearer token'
              }
              value={tiendaNubeAccessToken}
              onChange={(e) => setTiendaNubeAccessToken(e.target.value)}
              name="tienda-nube-access-token"
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
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
              disabled={syncCatalog.isPending || saveCatalog.isPending}
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
        {isExternalCatalog ? (
          <>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              Este partner usa catálogo externo: la tienda vive en su propio sitio
              {sponsor.external_store_url ? ` (${sponsor.external_store_url})` : ''}, así que no
              necesita dominio en x4.
            </p>
            {sponsor.custom_domain ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--warning)', fontSize: 14 }}>
                  Quedó cargado {sponsor.custom_domain} ({sponsor.custom_domain_status}).
                </span>
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={removeDomain.isPending}
                  onClick={() => removeDomain.mutate()}
                >
                  Quitar dominio
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
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
                className="input"
                style={{ flex: 1, width: 'auto', minWidth: 240 }}
                placeholder="tienda.ejemplo.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
              <button className="btn btn-primary" type="submit">
                Set dominio
              </button>
              <button
                className="btn btn-outline"
                type="button"
                disabled={!sponsor.custom_domain}
                onClick={() => verifyDomain.mutate()}
              >
                Verificar
              </button>
              {sponsor.custom_domain ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={removeDomain.isPending}
                  onClick={() => {
                    if (window.confirm(`¿Quitar el dominio ${sponsor.custom_domain}?`)) {
                      removeDomain.mutate();
                    }
                  }}
                >
                  Quitar dominio
                </button>
              ) : null}
            </form>
          </>
        )}
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

      <div className="card" style={{ marginTop: 16, borderColor: 'rgba(239, 68, 68, 0.35)' }}>
        <h3 style={{ color: '#fca5a5' }}>Eliminar partner</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Borra el partner, sus miembros, categorías, cupones y configuración de pagos. Los productos
          sin pedidos se borran; los que tienen pedidos quedan archivados y los pedidos se conservan.
          No se puede deshacer: si solo querés ocultarla, pausá la tienda.
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (deleteConfirm.trim() === sponsor.slug) deleteSponsor.mutate();
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}
        >
          <input
            className="input"
            style={{ flex: 1, width: 'auto', minWidth: 240 }}
            placeholder={`Escribí "${sponsor.slug}" para confirmar`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoComplete="off"
          />
          <button
            className="btn btn-danger"
            type="submit"
            disabled={deleteConfirm.trim() !== sponsor.slug || deleteSponsor.isPending}
          >
            {deleteSponsor.isPending ? 'Eliminando…' : 'Eliminar partner'}
          </button>
        </form>
      </div>
    </div>
  );
}
