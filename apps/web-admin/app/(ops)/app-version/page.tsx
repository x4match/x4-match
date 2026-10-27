'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Platform = 'ios' | 'android';

type PlatformVersion = {
  latestVersion: string | null;
  minVersion: string | null;
  storeUrl: string | null;
};

type AppVersionConfig = Record<Platform, PlatformVersion> & { message: string | null };

type PlatformForm = { latestVersion: string; minVersion: string; storeUrl: string };

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

const PLATFORMS: { key: Platform; label: string; storeHint: string }[] = [
  {
    key: 'android',
    label: 'Android',
    storeHint: 'https://play.google.com/store/apps/details?id=x4.match',
  },
  {
    key: 'ios',
    label: 'iOS',
    storeHint: 'https://apps.apple.com/app/id…',
  },
];

function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function toForm(value: PlatformVersion): PlatformForm {
  return {
    latestVersion: value.latestVersion ?? '',
    minVersion: value.minVersion ?? '',
    storeUrl: value.storeUrl ?? '',
  };
}

function platformErrors(form: PlatformForm) {
  const errors: string[] = [];
  const latest = form.latestVersion.trim();
  const min = form.minVersion.trim();
  const url = form.storeUrl.trim();
  if (latest && !VERSION_RE.test(latest)) errors.push('La última versión debe tener el formato 1.2.3.');
  if (min && !VERSION_RE.test(min)) errors.push('La versión mínima debe tener el formato 1.2.3.');
  if (latest && min && VERSION_RE.test(latest) && VERSION_RE.test(min) && compareVersions(min, latest) > 0) {
    errors.push('La versión mínima no puede ser mayor que la última.');
  }
  if (url && !/^https:\/\/\S+$/i.test(url)) errors.push('El link de la tienda debe empezar con https://.');
  if ((latest || min) && !url) errors.push('Sin link de la tienda la app no muestra el cartel.');
  return errors;
}

export default function AppVersionPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['platform-app-version'],
    queryFn: async () => (await api.get('/platform/app-version')).data as AppVersionConfig,
  });

  const [forms, setForms] = useState<Record<Platform, PlatformForm>>({
    ios: { latestVersion: '', minVersion: '', storeUrl: '' },
    android: { latestVersion: '', minVersion: '', storeUrl: '' },
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!data) return;
    setForms({ ios: toForm(data.ios), android: toForm(data.android) });
    setMessage(data.message ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: async () =>
      api
        .patch('/platform/app-version', {
          ios: forms.ios,
          android: forms.android,
          message,
        })
        .then((r) => r.data),
    meta: { successMessage: 'Versiones de la app actualizadas.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-app-version'] }),
  });

  const errors = Object.fromEntries(
    PLATFORMS.map((p) => [p.key, platformErrors(forms[p.key])]),
  ) as Record<Platform, string[]>;
  const blocking = PLATFORMS.some((p) =>
    errors[p.key].some((e) => !e.startsWith('Sin link')),
  );

  const setField = (platform: Platform, field: keyof PlatformForm, value: string) =>
    setForms((prev) => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }));

  return (
    <div>
      <div className="ops-page-header">
        <div>
          <h1 style={{ margin: 0 }}>Versión de la app</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            Si alguien tiene una versión menor a la <strong>última</strong>, la app le sugiere
            actualizar (puede cerrarlo y no se le vuelve a mostrar hasta la próxima versión). Si
            tiene una menor a la <strong>mínima</strong>, la app se bloquea hasta que actualice.
            Dejá un campo vacío para desactivarlo.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: 16 }}>Cargando…</div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!blocking) save.mutate();
          }}
          style={{ display: 'grid', gap: 16 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {PLATFORMS.map((platform) => (
              <div key={platform.key} className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{platform.label}</p>
                <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                  Última versión publicada (sugerir)
                  <input
                    className="input"
                    value={forms[platform.key].latestVersion}
                    onChange={(e) => setField(platform.key, 'latestVersion', e.target.value)}
                    placeholder="1.0.7"
                    inputMode="decimal"
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                  Versión mínima (obligatoria)
                  <input
                    className="input"
                    value={forms[platform.key].minVersion}
                    onChange={(e) => setField(platform.key, 'minVersion', e.target.value)}
                    placeholder="Vacío = no forzar"
                    inputMode="decimal"
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                  Link de la tienda
                  <input
                    className="input"
                    type="url"
                    value={forms[platform.key].storeUrl}
                    onChange={(e) => setField(platform.key, 'storeUrl', e.target.value)}
                    placeholder={platform.storeHint}
                  />
                </label>
                {errors[platform.key].length ? (
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--danger, #dc2626)', fontSize: 12 }}>
                    {errors[platform.key].map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
              Mensaje opcional del cartel
              <textarea
                className="input"
                rows={3}
                maxLength={300}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ej.: Sumamos noticias de clubes y mejoras en los torneos."
              />
            </label>
          </div>

          <div>
            <button className="btn btn-primary" type="submit" disabled={blocking || save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
