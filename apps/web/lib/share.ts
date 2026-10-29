import type { Metadata } from 'next';
import { SITE } from '@/content/site';

export type ShareKind = 'match' | 'club' | 'tournament' | 'player' | 'slot';

export type SharePreview = {
  title: string;
  description: string;
  image: string | null;
};

export const APP_SCHEME = 'x4match';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=x4.match';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function apiBase(): string {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.x4match.com').replace(
    /\/+$/,
    '',
  );
}

export function isUuid(value: string | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

export async function fetchSharePreview(
  kind: ShareKind,
  id: string,
  query?: Record<string, string | undefined>,
): Promise<SharePreview | null> {
  if (!isUuid(id)) return null;
  const params = new URLSearchParams(
    Object.entries(query ?? {}).filter((entry): entry is [string, string] => !!entry[1]),
  );
  try {
    const res = await fetch(
      `${apiBase()}/share/preview/${kind}/${id}${params.size ? `?${params}` : ''}`,
      { next: { revalidate: 120 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as SharePreview;
  } catch {
    return null;
  }
}

export function shareMetadata(preview: SharePreview | null, path: string, fallbackTitle: string): Metadata {
  const title = preview?.title ?? fallbackTitle;
  const description = preview?.description ?? 'Abrilo en la app de x4 match.';
  const url = `${SITE.url}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: 'es_AR',
      type: 'website',
      images: preview?.image ? [{ url: preview.image }] : undefined,
    },
    twitter: {
      card: preview?.image ? 'summary_large_image' : 'summary',
      title,
      description,
    },
    robots: { index: false },
  };
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
