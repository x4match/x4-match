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
import { usePendingNews } from '@/lib/use-pending-news';

const DEFAULT_FILTERS = { q: '', status: '', source: '', featured: '' };

type NewsPost = {
  id: string;
  source: 'CLUB' | 'PLAYER' | 'PLATFORM';
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

const NEWS_SOURCE_LABELS: Record<NewsPost['source'], string> = {
  CLUB: 'Club',
  PLAYER: 'Jugador',
  PLATFORM: 'Oficial x4 Match',
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

type NewsSettings = {
  defaultDurationDays: number;
  maxLivePerClub: number;
  maxPendingPerPlayer: number;
};

const NEWS_SETTING_FIELDS: {
  name: keyof NewsSettings;
  label: string;
  hint: string;
  max: number;
}[] = [
  {
    name: 'defaultDurationDays',
    label: 'Vigencia por defecto (días)',
    hint: 'Desde que se publica (clubes) o se aprueba (jugadores). No cambia las ya publicadas.',
    max: 365,
  },
  {
    name: 'maxLivePerClub',
    label: 'Máx. vigentes por club',
    hint: 'Noticias publicadas y sin vencer que un club puede tener a la vez.',
    max: 100,
  },
  {
    name: 'maxPendingPerPlayer',
    label: 'Máx. pendientes por jugador',
    hint: 'Noticias esperando aprobación que un jugador puede tener a la vez.',
    max: 50,
  },
];

function NewsSettingsCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['platform-news-settings'],
    queryFn: async () => (await api.get('/platform/news/settings')).data as NewsSettings,
  });
  const [values, setValues] = useState<Record<keyof NewsSettings, string>>({
    defaultDurationDays: '',
    maxLivePerClub: '',
    maxPendingPerPlayer: '',
  });

  useEffect(() => {
    if (!data) return;
    setValues({
      defaultDurationDays: String(data.defaultDurationDays),
      maxLivePerClub: String(data.maxLivePerClub),
      maxPendingPerPlayer: String(data.maxPendingPerPlayer),
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async (changes: Partial<NewsSettings>) =>
      api.patch('/platform/news/settings', changes).then((r) => r.data),
    meta: { successMessage: 'Configuración de noticias actualizada.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-news-settings'] }),
  });

  const parsed = NEWS_SETTING_FIELDS.map((field) => {
    const value = Number(values[field.name]);
    return {
      ...field,
      value,
      valid: Number.isInteger(value) && value >= 1 && value <= field.max,
    };
  });
  const allValid = parsed.every((field) => field.valid);
  const changes = Object.fromEntries(
    parsed
      .filter((field) => data && field.value !== data[field.name])
      .map((field) => [field.name, field.value]),
  ) as Partial<NewsSettings>;
  const dirty = Object.keys(changes).length > 0;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (allValid && dirty) save.mutate(changes);
        }}
        style={{ display: 'grid', gap: 12 }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Configuración de noticias</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {parsed.map((field) => (
            <label key={field.name} style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              {field.label}
              <input
                className="input"
                type="number"
                min={1}
                max={field.max}
                value={values[field.name]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                aria-invalid={!field.valid}
                style={{ width: 120 }}
              />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                {field.hint} (1 a {field.max})
              </span>
            </label>
          ))}
        </div>
        <div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!allValid || !dirty || save.isPending}
          >
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateNewsModal({
  open,
  defaultDays,
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultDays: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [days, setDays] = useState(String(defaultDays));
  const [featured, setFeatured] = useState(true);

  useEffect(() => {
    if (open) setDays(String(defaultDays));
  }, [open, defaultDays]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function reset() {
    setImage(null);
    setPreview(null);
    setTitle('');
    setBody('');
    setLinkUrl('');
    setFeatured(true);
  }

  const create = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('image', image!);
      form.append('title', title.trim());
      if (body.trim()) form.append('body', body.trim());
      if (linkUrl.trim()) form.append('linkUrl', linkUrl.trim());
      form.append('durationDays', days);
      form.append('featured', String(featured));
      return api.post('/platform/news', form).then((r) => r.data);
    },
    meta: { successMessage: 'Noticia publicada.' },
    onSuccess: () => {
      reset();
      onCreated();
    },
  });

  const parsedDays = Number(days);
  const canSubmit =
    !!image &&
    title.trim().length >= 3 &&
    Number.isInteger(parsedDays) &&
    parsedDays >= 1 &&
    parsedDays <= 365;

  return (
    <Modal open={open} title="Nueva noticia oficial" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) create.mutate();
        }}
        style={{ display: 'grid', gap: 12 }}
      >
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Imagen del banner (se recorta a 1200×525)
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 7',
              borderRadius: 12,
              border: '1px dashed var(--border, #333)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              'Elegir imagen'
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImage(file);
              setPreview(URL.createObjectURL(file));
            }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Título
          <input
            className="input"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Llega el Circuito x4 de verano"
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Descripción (opcional)
          <textarea
            className="input"
            value={body}
            maxLength={1000}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Link (opcional)
          <input
            className="input"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            Días de vigencia
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 8 }}>
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            Destacar en el carrusel del inicio
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={!canSubmit || create.isPending}>
            {create.isPending ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditNewsModal({
  post,
  onClose,
  onSaved,
}: {
  post: NewsPost | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setBody(post.body ?? '');
    setLinkUrl(post.linkUrl ?? '');
    setImage(null);
    setPreview(null);
  }, [post]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const save = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('body', body.trim());
      form.append('linkUrl', linkUrl.trim());
      if (image) form.append('image', image);
      return api.patch(`/platform/news/${post!.id}`, form).then((r) => r.data);
    },
    meta: { successMessage: 'Noticia actualizada.' },
    onSuccess: onSaved,
  });

  const canSubmit = title.trim().length >= 3;

  return (
    <Modal open={!!post} title="Editar noticia" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) save.mutate();
        }}
        style={{ display: 'grid', gap: 12 }}
      >
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Imagen del banner (tocá para reemplazarla)
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 7',
              borderRadius: 12,
              overflow: 'hidden',
              cursor: 'pointer',
              background: 'var(--surface, #111)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview ?? post?.imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImage(file);
              setPreview(URL.createObjectURL(file));
            }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Título
          <input
            className="input"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Descripción
          <textarea
            className="input"
            value={body}
            maxLength={1000}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Link
          <input
            className="input"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-outline" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit" disabled={!canSubmit || save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function NewsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
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
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const { data: pendingCount = 0 } = usePendingNews();

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
        <button className="btn btn-primary" type="button" onClick={() => setCreating(true)}>
          Nueva noticia
        </button>
      </div>

      <CreateNewsModal
        open={creating}
        defaultDays={settings?.defaultDurationDays ?? 7}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          refresh();
        }}
      />

      <EditNewsModal
        post={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />

      <NewsSettingsCard />

      {pendingCount > 0 && filters.status !== 'PENDING' ? (
        <div
          className="card"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>
            <span className="badge badge-warning" style={{ marginRight: 8 }}>
              {pendingCount}
            </span>
            {pendingCount === 1
              ? 'noticia de jugador espera aprobación.'
              : 'noticias de jugadores esperan aprobación.'}
          </span>
          <button className="btn btn-outline" type="button" onClick={() => setFilter('status', 'PENDING')}>
            Ver pendientes
          </button>
        </div>
      ) : null}

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
                            {NEWS_SOURCE_LABELS[post.source]}
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
                                className="btn btn-outline"
                                type="button"
                                onClick={() => setEditing(post)}
                              >
                                Editar
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
