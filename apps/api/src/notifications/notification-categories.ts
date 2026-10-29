import { PLAYER_CATEGORY_CODES, type PlayerCategoryCode } from '../common/utils/level-range.util';

export const NOTIFICATION_CATEGORIES = [
  'matches',
  'nearby_matches',
  'chat',
  'tournaments',
  'social',
  'club_offers',
  'achievements',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = Record<NotificationCategory, boolean>;

/** Preferencias completas: switches por categoría + categorías de juego para partidos cercanos. */
export type NotificationSettings = NotificationPreferences & {
  /** Vacío = solo la categoría propia del jugador. */
  nearby_match_categories: PlayerCategoryCode[];
};

const CLUB_OFFER_TYPES = new Set([
  'COURT_SLOT_AVAILABLE',
  'COURT_GAP_OFFER',
  'OPEN_MATCH_CREATED',
  'CLUB_SEGMENT_CAMPAIGN',
]);

/** `null` = notificación operativa que siempre se envía (no se puede desactivar). */
export function categoryForType(type: string): NotificationCategory | null {
  const normalized = type.toUpperCase();
  if (normalized === 'MATCH_CHAT_MESSAGE' || normalized.startsWith('DM_')) return 'chat';
  if (normalized === 'NEARBY_MATCH_CREATED') return 'nearby_matches';
  if (CLUB_OFFER_TYPES.has(normalized)) return 'club_offers';
  // CLUB_CHALLENGE es un desafío 2 vs 2 entre jugadores, no una promoción del club.
  if (normalized.startsWith('MATCH_') || normalized === 'CLUB_CHALLENGE') return 'matches';
  if (/^(TOURNAMENT|CIRCUIT|MASTER)_/.test(normalized)) return 'tournaments';
  if (normalized.startsWith('FRIEND_') || normalized === 'NEW_FOLLOWER') return 'social';
  if (/^(RANKING|BADGE|REWARD)_/.test(normalized)) return 'achievements';
  return null;
}

export function resolvePreferences(stored: unknown): NotificationPreferences {
  const source = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, source[category] !== false]),
  ) as NotificationPreferences;
}

export function resolveNearbyMatchCategories(stored: unknown): PlayerCategoryCode[] {
  const source = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const raw = source.nearby_match_categories;
  if (!Array.isArray(raw)) return [];
  return PLAYER_CATEGORY_CODES.filter((code) => raw.includes(code));
}

export function resolveSettings(stored: unknown): NotificationSettings {
  return {
    ...resolvePreferences(stored),
    nearby_match_categories: resolveNearbyMatchCategories(stored),
  };
}
