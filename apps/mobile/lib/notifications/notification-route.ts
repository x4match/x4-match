type NotificationData = Record<string, unknown>;

function asId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Pantalla a la que lleva una notificación, tanto desde la lista como desde un push. */
export function getNotificationRoute(type: string, data: NotificationData = {}): string | null {
  const fromUserId = asId(data.fromUserId);
  const matchId = asId(data.matchId);
  const clubId = asId(data.clubId);
  const challengeId = asId(data.challengeId);
  const tournamentId = asId(data.eventId) ?? asId(data.tournamentId);

  switch (type) {
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED':
    case 'NEW_FOLLOWER':
      return fromUserId ? `/player/${fromUserId}` : '/(tabs)/profile';
    case 'DM_MESSAGE':
    case 'DM_REQUEST':
    case 'DM_REQUEST_ACCEPTED':
      return '/(tabs)/messages';
    case 'CLUB_CHALLENGE':
      if (challengeId) return `/challenge/${challengeId}`;
      break;
  }

  if (matchId) return `/match/${matchId}`;
  if (clubId) return `/club/${clubId}`;
  if (tournamentId) return `/tournament/${tournamentId}`;
  return null;
}
