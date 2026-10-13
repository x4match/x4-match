import type { Match } from '@/lib/types';
import { formatMatchSchedule } from '@/lib/format';
import { API_URL } from '@/lib/api';

const PRODUCTION_SHARE_BASE_URL = 'https://api.x4match.com';

function shareBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  return API_URL.startsWith('https://') ? API_URL : PRODUCTION_SHARE_BASE_URL;
}

export function buildMatchShareLink(matchId: string): string {
  return `${shareBaseUrl()}/share/match/${matchId}`;
}

export function buildChallengeShareMessage(input: {
  challengeId: string;
  challengerName: string;
  challengedName: string;
  status: string;
  winnerName?: string | null;
}): string {
  const statusLine =
    input.status === 'COMPLETED' && input.winnerName
      ? `Resultado: ganó ${input.winnerName}`
      : `Estado: ${input.status.replace(/_/g, ' ')}`;
  return `Desafío x4 match\n${input.challengerName} vs ${input.challengedName}\n${statusLine}`;
}

export function buildMatchShareMessage(
  match: Pick<Match, 'id' | 'title' | 'date' | 'endsAt' | 'club' | 'venueNote'>,
): string {
  const when = formatMatchSchedule(match.date, match.endsAt);
  const clubPlace = [match.club?.city, match.club?.location, match.club?.address].filter(Boolean).join(' · ');
  const where = [match.club?.name, match.venueNote || clubPlace].filter(Boolean).join(', ');
  const locationLine = where ? `\n📍 ${where}` : '';
  return `Sumate a mi partido en x4 match: "${match.title}"\n🗓 ${when}${locationLine}\n\n${buildMatchShareLink(match.id)}`;
}

export async function invitePlayersToMatch(
  matchId: string,
  invites: { userId?: string; guestName?: string; role: 'partner' | 'opponent' }[],
) {
  const { api } = await import('@/lib/api');
  const res = await api.post(`/matches/${matchId}/invites`, { invites });
  return res.data;
}
