import type { ComponentProps } from 'react';
import { Alert } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { apiErrorMessage } from './staff';

export const LEVEL_LABELS = ['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va'] as const;
export const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function levelLabel(level?: number | null): string {
  if (level == null) return 'Sin categoría';
  return LEVEL_LABELS[level - 1] ?? 'Sin categoría';
}

export type CircuitPlayerStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';
export type LevelChangeReason = 'CORRECTION' | 'PROMOTION' | 'RELEGATION';

export const PLAYER_STATUS_LABELS: Record<CircuitPlayerStatus, string> = {
  ACTIVE: 'Validado',
  PENDING: 'A validar',
  INACTIVE: 'Inactivo',
};

export const LEVEL_SOURCE_LABELS: Record<string, string> = {
  APP: 'Categoría X4Match',
  CIRCUIT: 'Asignada por el circuito',
  REGISTRATION: 'Categoría del torneo',
};

export const LEVEL_REASON_LABELS: Record<string, string> = {
  INITIAL: 'Alta en el padrón',
  CORRECTION: 'Corrección',
  PROMOTION: 'Ascenso',
  RELEGATION: 'Descenso',
};

export type CircuitPlayer = {
  id: string;
  circuit_id: string;
  user_id?: string | null;
  full_name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  gender?: 'Caballeros' | 'Damas' | null;
  level: number | null;
  level_label: string | null;
  level_source: 'APP' | 'CIRCUIT' | 'REGISTRATION';
  app_level?: number | null;
  app_level_label?: string | null;
  status: CircuitPlayerStatus;
  notes?: string | null;
  photo_url?: string | null;
  tournaments_played?: number;
};

export type LevelHistoryEntry = {
  id: string;
  from_level: number | null;
  to_level: number | null;
  reason: 'INITIAL' | LevelChangeReason;
  note?: string | null;
  changed_by_name?: string | null;
  created_at: string;
};

export type CircuitPlayerStats = {
  totals: {
    tournaments: number;
    matches: number;
    wins: number;
    losses: number;
    walkoverWins: number;
    walkoverLosses: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    titles: number;
    finals: number;
    winRate: number;
  };
  recent: {
    matchId: string;
    tournamentId: string;
    tournamentName: string;
    roundLabel?: string | null;
    rival?: string | null;
    won: boolean;
    walkover: boolean;
    sets: [number, number][];
    playedAt: string;
  }[];
  placements: {
    placement: string;
    points: number;
    tournament_id: string;
    tournament_name: string;
    category_label: string;
    created_at: string;
  }[];
  ranking: {
    category_id: string;
    category_label: string;
    category_gender?: string | null;
    points: number;
    wins: number;
    losses: number;
    tournaments_played: number;
    position: number;
  }[];
};

export type CircuitPlayerDetail = {
  player: CircuitPlayer;
  history: LevelHistoryEntry[];
  stats: CircuitPlayerStats;
};

export type PromotionSuggestion = {
  categoryId: string;
  categoryLabel: string;
  categoryGender?: string | null;
  playerId: string;
  fullName: string;
  position: number;
  totalRanked: number;
  points: number;
  fromLevel: number;
  toLevel: number;
  direction: 'PROMOTION' | 'RELEGATION';
};

export type CircuitNews = {
  id: string;
  title: string;
  body: string;
  image_url?: string | null;
  pinned: boolean;
  author_name?: string | null;
  published_at: string;
};

export type SponsorTier = 'MAIN' | 'GOLD' | 'SILVER' | 'SUPPORT';

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  MAIN: 'Sponsor principal',
  GOLD: 'Oro',
  SILVER: 'Plata',
  SUPPORT: 'Acompaña',
};

export type CircuitSponsor = {
  id: string;
  name: string;
  logo_url?: string | null;
  website?: string | null;
  tier: SponsorTier;
  sort_order: number;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  summary: string;
  meta?: Record<string, unknown> | null;
  created_at: string;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_photo_url?: string | null;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

const AUDIT_ICONS: Array<[string, IconName]> = [
  ['player.', 'person-outline'],
  ['staff.', 'people-outline'],
  ['news.', 'newspaper-outline'],
  ['sponsor.', 'ribbon-outline'],
  ['zones.', 'grid-outline'],
  ['brackets.', 'git-network-outline'],
  ['results.', 'create-outline'],
  ['schedule.', 'calendar-outline'],
  ['registration.', 'clipboard-outline'],
  ['tournament.', 'trophy-outline'],
  ['category.', 'pricetags-outline'],
  ['event.', 'flag-outline'],
];

export function auditIcon(action: string): IconName {
  return AUDIT_ICONS.find(([prefix]) => action.startsWith(prefix))?.[1] ?? 'ellipse-outline';
}

// --- API ---

export async function fetchCircuitPlayers(
  circuitId: string,
  filters: { q?: string; level?: number | null; status?: CircuitPlayerStatus | null } = {},
): Promise<CircuitPlayer[]> {
  const res = await api.get(`/circuits/${circuitId}/players`, {
    params: {
      q: filters.q || undefined,
      level: filters.level || undefined,
      status: filters.status || undefined,
    },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchCircuitPlayer(circuitId: string, playerId: string): Promise<CircuitPlayerDetail> {
  const res = await api.get(`/circuits/${circuitId}/players/${playerId}`);
  return res.data;
}

export async function createCircuitPlayer(
  circuitId: string,
  payload: {
    userId?: string;
    fullName?: string;
    document?: string;
    phone?: string;
    email?: string;
    city?: string;
    gender?: 'Caballeros' | 'Damas';
    level?: number;
  },
): Promise<CircuitPlayer> {
  const res = await api.post(`/circuits/${circuitId}/players`, payload);
  return res.data;
}

export async function updateCircuitPlayer(
  circuitId: string,
  playerId: string,
  payload: Partial<Pick<CircuitPlayer, 'full_name' | 'status'>> & {
    fullName?: string;
    phone?: string;
    email?: string;
    document?: string;
    city?: string;
    notes?: string;
  },
): Promise<CircuitPlayer> {
  const { full_name: _f, ...rest } = payload;
  const res = await api.patch(`/circuits/${circuitId}/players/${playerId}`, rest);
  return res.data;
}

export async function setCircuitPlayerLevel(
  circuitId: string,
  playerId: string,
  payload: { level: number; reason?: LevelChangeReason; note?: string },
): Promise<CircuitPlayer> {
  const res = await api.put(`/circuits/${circuitId}/players/${playerId}/level`, payload);
  return res.data;
}

export async function syncCircuitPlayers(circuitId: string): Promise<{ linked: number }> {
  const res = await api.post(`/circuits/${circuitId}/players/sync`);
  return res.data;
}

export async function fetchPromotionSuggestions(
  circuitId: string,
  params: { promoteTop: number; relegateBottom: number },
): Promise<{ promoteTop: number; relegateBottom: number; suggestions: PromotionSuggestion[] }> {
  const res = await api.get(`/circuits/${circuitId}/players/promotions`, { params });
  return res.data;
}

export async function applyLevelChanges(
  circuitId: string,
  changes: { playerId: string; toLevel: number; reason: LevelChangeReason }[],
  note?: string,
): Promise<{ applied: number }> {
  const res = await api.post(`/circuits/${circuitId}/players/level-changes`, { changes, note });
  return res.data;
}

export async function fetchCircuitNews(circuitId: string): Promise<CircuitNews[]> {
  const res = await api.get(`/circuits/${circuitId}/news`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createCircuitNews(
  circuitId: string,
  payload: { title: string; body: string; pinned?: boolean },
): Promise<CircuitNews> {
  const res = await api.post(`/circuits/${circuitId}/news`, payload);
  return res.data;
}

export async function updateCircuitNews(
  circuitId: string,
  newsId: string,
  payload: { title?: string; body?: string; pinned?: boolean },
): Promise<CircuitNews> {
  const res = await api.patch(`/circuits/${circuitId}/news/${newsId}`, payload);
  return res.data;
}

export async function deleteCircuitNews(circuitId: string, newsId: string) {
  return api.delete(`/circuits/${circuitId}/news/${newsId}`);
}

export async function fetchCircuitSponsors(circuitId: string): Promise<CircuitSponsor[]> {
  const res = await api.get(`/circuits/${circuitId}/sponsors`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createCircuitSponsor(
  circuitId: string,
  payload: { name: string; website?: string; tier?: SponsorTier },
): Promise<CircuitSponsor> {
  const res = await api.post(`/circuits/${circuitId}/sponsors`, payload);
  return res.data;
}

export async function updateCircuitSponsor(
  circuitId: string,
  sponsorId: string,
  payload: { name?: string; website?: string; tier?: SponsorTier; sortOrder?: number },
): Promise<CircuitSponsor> {
  const res = await api.patch(`/circuits/${circuitId}/sponsors/${sponsorId}`, payload);
  return res.data;
}

export async function deleteCircuitSponsor(circuitId: string, sponsorId: string) {
  return api.delete(`/circuits/${circuitId}/sponsors/${sponsorId}`);
}

async function pickAndUpload<T>(opts: {
  url: string;
  field: string;
  aspect: [number, number];
  permissionMessage: string;
  errorMessage: string;
}): Promise<T | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', opts.permissionMessage);
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: opts.aspect,
    quality: 0.85,
  });
  const uri = result.canceled ? null : result.assets?.[0]?.uri;
  if (!uri) return null;
  const lower = uri.toLowerCase();
  const type = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const form = new FormData();
  form.append(opts.field, { uri, name: `${opts.field}.${type.split('/')[1]}`, type } as any);
  try {
    const res = await api.post(opts.url, form);
    return res.data;
  } catch (error) {
    Alert.alert('Error', apiErrorMessage(error, opts.errorMessage));
    return null;
  }
}

/** Elige una imagen de la galería y la sube; devuelve null si se cancela o falla. */
export function pickAndUploadSponsorLogo(circuitId: string, sponsorId: string) {
  return pickAndUpload<CircuitSponsor>({
    url: `/circuits/${circuitId}/sponsors/${sponsorId}/logo`,
    field: 'logo',
    aspect: [2, 1],
    permissionMessage: 'Necesitamos acceso a tu galería para el logo del sponsor',
    errorMessage: 'No se pudo subir el logo',
  });
}

export function pickAndUploadNewsImage(circuitId: string, newsId: string) {
  return pickAndUpload<CircuitNews>({
    url: `/circuits/${circuitId}/news/${newsId}/image`,
    field: 'image',
    aspect: [16, 9],
    permissionMessage: 'Necesitamos acceso a tu galería para la imagen de la noticia',
    errorMessage: 'No se pudo subir la imagen',
  });
}

export async function fetchCircuitActivity(
  circuitId: string,
  params: { before?: string; limit?: number } = {},
): Promise<AuditEntry[]> {
  const res = await api.get(`/circuits/${circuitId}/activity`, { params });
  return Array.isArray(res.data) ? res.data : [];
}
