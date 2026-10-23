import { api } from './api';

export type NewsPost = {
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
};

export function newsErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function getNewsSettings() {
  const res = await api.get('/news/settings');
  return res.data as { defaultDurationDays: number };
}

export async function listClubNews(clubId: string) {
  const res = await api.get(`/news/club/${clubId}`);
  return res.data as NewsPost[];
}

export async function createClubNews(
  clubId: string,
  payload: { image: File; title: string; body?: string; linkUrl?: string },
) {
  const form = new FormData();
  form.append('image', payload.image);
  form.append('title', payload.title.trim());
  if (payload.body?.trim()) form.append('body', payload.body.trim());
  if (payload.linkUrl?.trim()) form.append('linkUrl', payload.linkUrl.trim());
  const res = await api.post(`/news/club/${clubId}`, form);
  return res.data as NewsPost;
}

export async function deleteNews(id: string) {
  await api.delete(`/news/${id}`);
}
