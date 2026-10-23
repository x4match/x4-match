type NotificationData = Record<string, unknown>;

function asId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}

/** Pantalla a la que lleva una notificación, tanto desde la lista como desde un push. */
export function getNotificationRoute(type: string, data: NotificationData = {}): string | null {
  const fromUserId = asId(data.fromUserId);
  const matchId = asId(data.matchId);
  const clubId = asId(data.clubId);
  const challengeId = asId(data.challengeId);
  const tournamentId = asId(data.eventId) ?? asId(data.tournamentId);
  const conversationId = asId(data.conversationId);

  switch (type) {
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED':
    case 'NEW_FOLLOWER':
      return fromUserId ? `/player/${fromUserId}` : '/(tabs)/profile';
    case 'DM_MESSAGE':
    case 'DM_REQUEST':
    case 'DM_REQUEST_ACCEPTED':
      if (!conversationId) return '/(tabs)/messages';
      return withQuery(`/conversation/${conversationId}`, {
        name: asId(data.fromUserName),
        userId: fromUserId,
        clubId: asId(data.fromClubId),
        status: type === 'DM_REQUEST' ? 'pending' : 'active',
      });
    case 'MATCH_CHAT_MESSAGE':
      if (matchId) return withQuery(`/match/${matchId}`, { chat: '1' });
      break;
    case 'CLUB_CHALLENGE':
      if (challengeId) return `/challenge/${challengeId}`;
      break;
    case 'NEWS_APPROVED':
      return asId(data.newsId) ? `/news/${asId(data.newsId)}` : '/news/mine';
    case 'NEWS_REJECTED':
      return '/news/mine';
  }

  if (matchId) return `/match/${matchId}`;
  if (clubId) return `/club/${clubId}`;
  if (tournamentId) return `/tournament/${tournamentId}`;
  return null;
}
