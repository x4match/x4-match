import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getRealtimeSocket, useRealtimeConnected, watchMatchRoom } from '@/lib/realtime';

export type LiveTeam = 'A' | 'B';
export type LiveDeuceMode = 'advantage' | 'golden';
export type LivePhase = 'game' | 'tiebreak' | 'super_tiebreak';
export type LiveScoreStatus = 'NOT_STARTED' | 'LIVE' | 'FINISHED';

export type LiveTeamPair = { teamA: number; teamB: number };

export type LiveCompletedSet = LiveTeamPair & {
  tiebreak?: LiveTeamPair;
  superTiebreak?: boolean;
};

export type LiveTeamMember = {
  id: string;
  name: string;
  photo: string | null;
  isGuest: boolean;
};

export type LiveScoreViewer = {
  isParticipant: boolean;
  canScore: boolean;
  canStart: boolean;
};

export type MatchLiveScore = {
  matchId: string;
  status: LiveScoreStatus;
  teams: Record<LiveTeam, LiveTeamMember[]>;
  config?: { deuceMode: LiveDeuceMode; superTiebreak: boolean };
  sets?: LiveCompletedSet[];
  games?: LiveTeamPair;
  points?: LiveTeamPair;
  phase?: LivePhase;
  winner?: LiveTeam | null;
  display?: { teamA: string; teamB: string; label: string | null };
  matchPointFor?: LiveTeam | null;
  setPointFor?: LiveTeam | null;
  totalPoints?: number;
  canUndo?: boolean;
  version?: number;
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  startedBy?: { id: string; name: string | null } | null;
  lastUpdatedBy?: { id: string; name: string | null } | null;
  viewer?: LiveScoreViewer;
};

export const liveScoreQueryKey = (matchId: string) => ['match-live', matchId] as const;

export async function fetchMatchLiveScore(matchId: string): Promise<MatchLiveScore> {
  const res = await api.get(`/matches/${matchId}/live`);
  return res.data;
}

export async function startMatchLiveScore(
  matchId: string,
  body: { deuceMode: LiveDeuceMode; superTiebreak: boolean },
): Promise<MatchLiveScore> {
  const res = await api.post(`/matches/${matchId}/live/start`, body);
  return res.data;
}

export async function addMatchLivePoint(
  matchId: string,
  team: LiveTeam,
  version?: number,
): Promise<MatchLiveScore> {
  const res = await api.post(`/matches/${matchId}/live/point`, { team, version });
  return res.data;
}

export async function undoMatchLivePoint(matchId: string, version?: number): Promise<MatchLiveScore> {
  const res = await api.post(`/matches/${matchId}/live/undo`, { version });
  return res.data;
}

export async function discardMatchLiveScore(matchId: string): Promise<MatchLiveScore> {
  const res = await api.delete(`/matches/${matchId}/live`);
  return res.data;
}

export function teamLabel(members: LiveTeamMember[] | undefined, fallback: string) {
  if (!members?.length) return fallback;
  return members.map((m) => m.name.split(' ')[0]).join(' / ');
}

/**
 * Marcador del partido: se actualiza por socket y, si el socket no conecta
 * (p. ej. API serverless), cae a polling corto mientras el partido está en vivo.
 */
export function useMatchLiveScore(matchId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const connected = useRealtimeConnected();
  const active = !!matchId && enabled;

  const query = useQuery({
    queryKey: liveScoreQueryKey(matchId ?? ''),
    queryFn: () => fetchMatchLiveScore(matchId!),
    enabled: active,
    refetchInterval: (q) => {
      if (q.state.data?.status !== 'LIVE') return false;
      return connected ? 30_000 : 4_000;
    },
  });

  useEffect(() => {
    if (!active) return;
    const socket = getRealtimeSocket();
    const onLiveScore = (payload: MatchLiveScore) => {
      if (payload?.matchId !== matchId) return;
      const key = liveScoreQueryKey(matchId!);
      const previous = queryClient.getQueryData<MatchLiveScore>(key);
      if (previous?.version != null && payload.version != null && payload.version < previous.version) {
        return;
      }
      const viewer = previous?.viewer;
      queryClient.setQueryData<MatchLiveScore>(key, {
        ...payload,
        viewer: viewer
          ? {
              ...viewer,
              canScore: viewer.isParticipant && payload.status === 'LIVE',
              canStart: viewer.canStart && payload.status === 'NOT_STARTED',
            }
          : undefined,
      });
      if (payload.status !== 'LIVE') {
        queryClient.invalidateQueries({ queryKey: key });
        queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      }
    };

    const unwatch = watchMatchRoom(matchId!);
    socket.on('match:live_score', onLiveScore);
    return () => {
      unwatch();
      socket.off('match:live_score', onLiveScore);
    };
  }, [active, matchId, queryClient]);

  return query;
}
