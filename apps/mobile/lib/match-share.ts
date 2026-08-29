import type { Match } from './types';
import { formatMatchSchedule } from './format';

export function buildMatchShareLink(matchId: string): string {
  return `playtomic://match/${matchId}`;
}

export function buildMatchShareMessage(match: Pick<Match, 'id' | 'title' | 'date' | 'endsAt' | 'club' | 'zone'>): string {
  const when = formatMatchSchedule(match.date, match.endsAt);
  const where = [match.club?.name, match.zone].filter(Boolean).join(', ');
  const locationLine = where ? `\n📍 ${where}` : '';
  return `Sumate a mi partido en x4 match: "${match.title}"\n🗓 ${when}${locationLine}\n\n${buildMatchShareLink(match.id)}`;
}

export async function invitePlayersToMatch(
  matchId: string,
  invites: { userId?: string; guestName?: string; role: 'partner' | 'opponent' }[],
) {
  const { api } = await import('./api');
  const res = await api.post(`/matches/${matchId}/invites`, { invites });
  return res.data;
}
