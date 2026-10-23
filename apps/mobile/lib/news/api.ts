import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';

export type NewsSource = 'CLUB' | 'PLAYER' | 'PLATFORM';

export const NEWS_SOURCE_LABELS: Record<NewsSource, string> = {
  CLUB: 'Club',
  PLAYER: 'Jugador',
  PLATFORM: 'Oficial',
};

export type NewsStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED';

export type NewsPost = {
  id: string;
  source: NewsSource;
  title: string;
  body: string | null;
  linkUrl: string | null;
  imageUrl: string;
  status: NewsStatus;
  isLive: boolean;
  isFeatured: boolean;
  durationDays: number;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  reviewNotes: string | null;
  author: { id: string; name: string; photoUrl: string | null };
  club: { id: string; name: string; logoUrl: string | null } | null;
};

/** Proporción del banner del carrusel (ancho / alto). El backend recorta a 1200x525. */
export const NEWS_BANNER_ASPECT = 16 / 7;

export const NEWS_QUERY_KEYS = {
  banners: ['news-banners'] as const,
  list: (filters: NewsListFilters) => ['news-list', filters] as const,
  listAll: ['news-list'] as const,
  mine: ['news-mine'] as const,
  club: (clubId: string) => ['news-club', clubId] as const,
  detail: (id: string) => ['news-detail', id] as const,
  settings: ['news-settings'] as const,
};

export type NewsFilterKey = 'all' | 'featured' | 'official' | 'club' | 'player';

export type NewsListFilters = { filter: NewsFilterKey; q: string };

export const NEWS_FILTER_OPTIONS: { key: NewsFilterKey; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'featured', label: 'Destacadas' },
  { key: 'official', label: 'Oficiales' },
  { key: 'club', label: 'Clubes' },
  { key: 'player', label: 'Jugadores' },
];

export const NEWS_PAGE_SIZE = 20;

const FILTER_SOURCE: Partial<Record<NewsFilterKey, NewsSource>> = {
  official: 'PLATFORM',
  club: 'CLUB',
  player: 'PLAYER',
};

export type NewsPage = { items: NewsPost[]; total: number; limit: number; offset: number };

export async function fetchNewsList(filters: NewsListFilters, offset = 0): Promise<NewsPage> {
  const res = await api.get('/news', {
    params: {
      q: filters.q.trim() || undefined,
      featured: filters.filter === 'featured' ? 'true' : undefined,
      source: FILTER_SOURCE[filters.filter],
      limit: NEWS_PAGE_SIZE,
      offset,
    },
  });
  return res.data as NewsPage;
}

export async function fetchNewsBanners(): Promise<NewsPost[]> {
  const res = await api.get('/news/banners');
  return res.data as NewsPost[];
}

export async function fetchNewsSettings(): Promise<{ defaultDurationDays: number }> {
  const res = await api.get('/news/settings');
  return res.data as { defaultDurationDays: number };
}

export async function fetchNewsPost(id: string): Promise<NewsPost> {
  const res = await api.get(`/news/${id}`);
  return res.data as NewsPost;
}

export async function fetchMyNews(): Promise<NewsPost[]> {
  const res = await api.get('/news/mine');
  return res.data as NewsPost[];
}

export async function fetchClubNews(clubId: string): Promise<NewsPost[]> {
  const res = await api.get(`/news/club/${clubId}`);
  return res.data as NewsPost[];
}

export async function deleteNewsPost(id: string): Promise<void> {
  await api.delete(`/news/${id}`);
}

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export async function createNewsPost(params: {
  imageUri: string;
  title: string;
  body?: string;
  linkUrl?: string;
  clubId?: string | null;
}): Promise<NewsPost> {
  const ext = params.imageUri.split('.').pop()?.toLowerCase();
  const filename = ext && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)
    ? `news.${ext === 'jpeg' ? 'jpg' : ext}`
    : 'news.jpg';

  const formData = new FormData();
  formData.append('image', { uri: params.imageUri, name: filename, type: guessMimeType(params.imageUri) } as any);
  formData.append('title', params.title.trim());
  if (params.body?.trim()) formData.append('body', params.body.trim());
  if (params.linkUrl?.trim()) formData.append('linkUrl', params.linkUrl.trim());

  const path = params.clubId ? `/news/club/${params.clubId}` : '/news';
  const res = await api.post(path, formData, { timeout: 60_000 });
  return res.data as NewsPost;
}

export async function pickNewsImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para elegir la imagen del banner');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 7],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

export function newsErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

export function newsAuthorLabel(post: Pick<NewsPost, 'club' | 'author' | 'source'>): string {
  if (post.source === 'PLATFORM') return 'x4 Match';
  return post.club?.name ?? post.author.name;
}

export function newsAuthorPhoto(post: Pick<NewsPost, 'club' | 'author' | 'source'>): string | undefined {
  if (post.source === 'PLATFORM') return undefined;
  return post.club?.logoUrl ?? post.author.photoUrl ?? undefined;
}

/** Estado legible para el autor: una aprobada que ya venció se muestra como vencida. */
export function newsDisplayStatus(post: NewsPost): string {
  if (post.status === 'APPROVED') return post.isLive ? 'ACTIVE' : 'EXPIRED';
  return post.status;
}
