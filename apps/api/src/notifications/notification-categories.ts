export const NOTIFICATION_CATEGORIES = [
  'matches',
  'chat',
  'tournaments',
  'social',
  'club_offers',
  'achievements',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = Record<NotificationCategory, boolean>;

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
