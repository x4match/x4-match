'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Modal } from '@/components/Modal';
import { TableFilters } from '@/components/TableFilters';
import { TablePagination } from '@/components/TablePagination';
import { api } from '@/lib/api';
import { NEWS_FEATURED, NEWS_SOURCES, NEWS_STATUSES } from '@/lib/filter-options';
import { usePaginatedPlatformList } from '@/lib/use-paginated-platform-list';

const DEFAULT_FILTERS = { q: '', status: 'PENDING', source: '', featured: '' };

type NewsPost = {
  id: string;
  source: 'CLUB' | 'PLAYER';
  title: string;
  body: string | null;
  linkUrl: string | null;
  imageUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED';
  isLive: boolean;
  isFeatured: boolean;
  durationDays: number;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewedByName: string | null;
  author: { id: string; name: string };
  club: { id: string; name: string } | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalInputValue(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(post: NewsPost) {
  if (post.status === 'APPROVED') {
    return post.isLive
      ? { label: 'Publicada', tone: 'success' }
      : { label: 'Vencida', tone: 'neutral' };
  }
  if (post.status === 'PENDING') return { label: 'Pendiente', tone: 'warning' };
  if (post.status === 'REJECTED') return { label: 'Rechazada', tone: 'danger' };
  return { label: 'Eliminada', tone: 'neutral' };
}

function NewsSettingsCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['platform-news-settings'],
    queryFn: async () =>
      (await api.get('/platform/news/settings')).data as { defaultDurationDays: number },
  });
  const [days, setDays] = useState('');

  useEffect(() => {
    if (data) setDays(String(data.defaultDurationDays));
  }, [data]);

  const save = useMutation({
    mutationFn: async (value: number) =>
      api.patch('/platform/news/settings', { defaultDurationDays: value }).then((r) => r.data),
    meta: { successMessage: 'Vigencia por defecto actualizada.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-news-settings'] }),
  });

  const parsed = Number(days);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 365;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate(parsed);
        }}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}
      >
        <div style={{ flex: '1 1 260px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Vigencia por defecto</p>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Días que una noticia queda visible desde que se publica (clubes) o se aprueba
            (jugadores). No cambia las noticias ya publicadas.
          </p>
        </div>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Días
          <input
            className="input"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            style={{ width: 110 }}
          />
        </label>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!valid || save.isPending || parsed === data?.defaultDurationDays}
        >
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}

export default function NewsPage() {
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
    endpoint: '/platform/news',
    queryKey: 'platform-news',
    defaultFilters: DEFAULT_FILTERS,
  });
  const { data: settings } = useQuery({
    queryKey: ['platform-news-settings'],
    queryFn: async () =>
      (await api.get('/platform/news/settings')).data as { defaultDurationDays: number },
  });

  const [approving, setApproving] = useState<NewsPost | null>(null);
  const [approveDays, setApproveDays] = useState('');
  const [approveFeatured, setApproveFeatured] = useState(false);
  const [rejecting, setRejecting] = useState<NewsPost | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [editingExpiry, setEditingExpiry] = useState<NewsPost | null>(null);
  const [expiryValue, setExpiryValue] = useState('');
  const [preview, setPreview] = useState<NewsPost | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-news'] });
    queryClient.invalidateQueries({ queryKey: ['platform-news-pending'] });
  };

  const approve = useMutation({
    mutationFn: async ({
      id,
      durationDays,
      featured,
    }: {
      id: string;
      durationDays: number;
      featured: boolean;
    }) => api.post(`/platform/news/${id}/approve`, { durationDays, featured }).then((r) => r.data),
    meta: { successMessage: 'Noticia aprobada y publicada.' },
    onSuccess: () => {
      refresh();
      setApproving(null);
    },
  });

  const toggleFeatured = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) =>
      api.patch(`/platform/news/${id}/featured`, { featured }).then((r) => r.data),
    meta: { successMessage: 'Carrusel actualizado.' },
    onSuccess: refresh,
  });

  const reject = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) =>
      api.post(`/platform/news/${id}/reject`, { notes: notes || undefined }).then((r) => r.data),
    meta: { successMessage: 'Noticia rechazada.' },
    onSuccess: () => {
      refresh();
      setRejecting(null);
      setRejectNotes('');
    },
  });

  const updateExpiry = useMutation({
    mutationFn: async ({ id, expiresAt }: { id: string; expiresAt: string }) =>
      api.patch(`/platform/news/${id}/expiry`, { expiresAt }).then((r) => r.data),
    meta: { successMessage: 'Vigencia actualizada.' },
    onSuccess: () => {
      refresh();
      setEditingExpiry(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/news/${id}`).then((r) => r.data),
    meta: { successMessage: 'Noticia eliminada.' },
    onSuccess: refresh,
  });

  function openApprove(post: NewsPost) {
    setApproving(post);
    setApproveDays(String(settings?.defaultDurationDays ?? post.durationDays));
    setApproveFeatured(post.isFeatured);
  }

  function onApprove(e: FormEvent) {
    e.preventDefault();
    const days = Number(approveDays);
    if (!approving || !Number.isInteger(days) || days < 1 || days > 365) return;
    approve.mutate({ id: approving.id, durationDays: days, featured: approveFeatured });
  }

  function onReject(e: FormEvent) {
    e.preventDefault();
    if (!rejecting) return;
    reject.mutate({ id: rejecting.id, notes: rejectNotes.trim() });
  }

  function onSaveExpiry(e: FormEvent) {
    e.preventDefault();
    if (!editingExpiry || !expiryValue) return;
    updateExpiry.mutate({ id: editingExpiry.id, expiresAt: new Date(expiryValue).toISOString() });
  }

  const rows = items as NewsPost[];

  return (
    <div>
      <div className="ops-page-header">
        <div>
          <h1 style={{ margin: 0 }}>Noticias</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            Todas las publicadas aparecen en Novedades; solo las destacadas van al carrusel del
            inicio. Las de jugadores no se muestran hasta que las apruebes; las de clubes se
            publican directo.
          </p>
        </div>
      </div>

      <NewsSettingsCard />

      <TableFilters
        fields={[
          { type: 'search', key: 'q', placeholder: 'Buscar por título, autor o club…' },
          { type: 'select', key: 'status', label: 'Estado', options: NEWS_STATUSES },
          { type: 'select', key: 'source', label: 'Origen', options: NEWS_SOURCES },
          { type: 'select', key: 'featured', label: 'Carrusel', options: NEWS_FEATURED },
        ]}
        values={filters}
        onChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
        error={errorMessage}
      />

      <Modal open={!!approving} title="Aprobar noticia" onClose={() => setApproving(null)}>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          “{approving?.title}” se publica ahora y queda visible la cantidad de días que indiques.
        </p>
        <form onSubmit={onApprove} style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            Días de vigencia
            <input
              className="input"
              type="number"
              min={1}
              max={365}
              value={approveDays}
              onChange={(e) => setApproveDays(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={approveFeatured}
              onChange={(e) => setApproveFeatured(e.target.checked)}
            />
            Destacar en el carrusel del inicio
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" type="button" onClick={() => setApproving(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={approve.isPending}>
              {approve.isPending ? 'Aprobando…' : 'Aprobar y publicar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!rejecting}
        title="Rechazar noticia"
        onClose={() => {
          setRejecting(null);
          setRejectNotes('');
        }}
      >
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          El autor recibe una notificación con el motivo (si lo completás).
        </p>
        <form onSubmit={onReject} style={{ display: 'grid', gap: 10 }}>
          <textarea
            className="input"
            placeholder="Motivo (opcional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" type="button" onClick={() => setRejecting(null)}>
              Cancelar
            </button>
            <button className="btn btn-danger" type="submit" disabled={reject.isPending}>
              {reject.isPending ? 'Rechazando…' : 'Rechazar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editingExpiry} title="Cambiar vigencia" onClose={() => setEditingExpiry(null)}>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          Publicada el {formatDateTime(editingExpiry?.publishedAt)}. Elegí hasta cuándo se muestra
          (una fecha pasada la oculta).
        </p>
        <form onSubmit={onSaveExpiry} style={{ display: 'grid', gap: 10 }}>
          <input
            className="input"
            type="datetime-local"
            value={expiryValue}
            onChange={(e) => setExpiryValue(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" type="button" onClick={() => setEditingExpiry(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={updateExpiry.isPending}>
              {updateExpiry.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!preview} title={preview?.title ?? ''} onClose={() => setPreview(null)}>
        {preview ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.imageUrl}
              alt=""
              style={{ width: '100%', aspectRatio: '16 / 7', objectFit: 'cover', borderRadius: 12 }}
            />
            {preview.body ? (
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{preview.body}</p>
            ) : (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Sin descripción.</p>
            )}
            {preview.linkUrl ? (
              <a
                href={preview.linkUrl}
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: 'var(--primary)', fontSize: 14, wordBreak: 'break-all' }}
              >
                {preview.linkUrl}
              </a>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <div className="card card-table">
        {isLoading ? (
          <p style={{ padding: 16, margin: 0 }}>Cargando noticias…</p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Banner</th>
                  <th>Título</th>
                  <th>Autor</th>
                  <th>Creada</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {filters.status === 'PENDING'
                        ? 'No hay noticias pendientes de aprobación.'
                        : 'No hay noticias con esos filtros.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((post) => {
                    const badge = statusBadge(post);
                    return (
                      <tr key={post.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => setPreview(post)}
                            aria-label={`Ver noticia ${post.title}`}
                            style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.imageUrl}
                              alt=""
                              style={{
                                width: 128,
                                aspectRatio: '16 / 7',
                                objectFit: 'cover',
                                borderRadius: 8,
                                display: 'block',
                              }}
                            />
                          </button>
                        </td>
                        <td style={{ maxWidth: 260 }}>
                          <div style={{ fontWeight: 600 }}>{post.title}</div>
                          {post.body ? (
                            <div
                              style={{
                                color: 'var(--muted)',
                                fontSize: 12,
                                marginTop: 2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {post.body}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {post.club ? (
                            <Link href={`/clubs/${post.club.id}`} style={{ color: 'var(--primary)' }}>
                              {post.club.name}
                            </Link>
                          ) : (
                            <Link href={`/users/${post.author.id}`} style={{ color: 'var(--primary)' }}>
                              {post.author.name}
                            </Link>
                          )}
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {post.source === 'CLUB' ? 'Club' : 'Jugador'}
                          </div>
                        </td>
                        <td>{formatDateTime(post.createdAt)}</td>
                        <td>
                          {post.status === 'APPROVED' ? (
                            <>
                              <div>Hasta {formatDateTime(post.expiresAt)}</div>
                              <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                                {post.durationDays} día{post.durationDays === 1 ? '' : 's'}
                              </div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${badge.tone}`}>{badge.label}</span>
                          {post.isFeatured ? (
                            <span className="badge badge-success" style={{ marginLeft: 6 }}>
                              ★ Destacada
                            </span>
                          ) : null}
                          {post.reviewedAt ? (
                            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                              {formatDateTime(post.reviewedAt)}
                              {post.reviewedByName ? ` · ${post.reviewedByName}` : ''}
                              {post.reviewNotes ? (
                                <div style={{ marginTop: 2 }}>{post.reviewNotes}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {post.status === 'PENDING' || post.status === 'REJECTED' ? (
                              <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() => openApprove(post)}
                              >
                                Aprobar
                              </button>
                            ) : null}
                            {post.status === 'PENDING' ? (
                              <button
                                className="btn btn-outline"
                                type="button"
                                onClick={() => setRejecting(post)}
                              >
                                Rechazar
                              </button>
                            ) : null}
                            {post.status === 'APPROVED' ? (
                              <button
                                className={post.isFeatured ? 'btn btn-outline' : 'btn btn-primary'}
                                type="button"
                                disabled={toggleFeatured.isPending}
                                onClick={() =>
                                  toggleFeatured.mutate({ id: post.id, featured: !post.isFeatured })
                                }
                              >
                                {post.isFeatured ? 'Quitar destacado' : 'Destacar'}
                              </button>
                            ) : null}
                            {post.status === 'APPROVED' ? (
                              <button
                                className="btn btn-outline"
                                type="button"
                                onClick={() => {
                                  setEditingExpiry(post);
                                  setExpiryValue(toLocalInputValue(post.expiresAt));
                                }}
                              >
                                Vigencia
                              </button>
                            ) : null}
                            {post.status !== 'DELETED' ? (
                              <button
                                className="btn btn-ghost"
                                type="button"
                                disabled={remove.isPending}
                                onClick={() => {
                                  if (window.confirm(`¿Eliminar "${post.title}"?`)) {
                                    remove.mutate(post.id);
                                  }
                                }}
                              >
                                Eliminar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
