import { QueryClient, useQuery } from '@tanstack/react-query';
import { api } from './api';

export type RedeemablePointsSummary = {
  points: number;
  matchesAtClub: number;
  monthKey?: string;
  monthlyPoints?: number;
  monthlyMatchesPlayed?: number;
  lastPlayedAt?: string | null;
};

/** Saldo global canjeable; la API exige un clubId válido pero devuelve el total de todos los clubes. */
export const REDEEMABLE_POINTS_QUERY_KEY = ['redeemable-points'] as const;

export async function fetchRedeemablePoints(clubId: string): Promise<RedeemablePointsSummary> {
  const res = await api.get(`/clubs/${clubId}/my-points`);
  return res.data;
}

export function invalidateRedeemablePoints(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: REDEEMABLE_POINTS_QUERY_KEY });
}

export function useRedeemablePoints(clubId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: REDEEMABLE_POINTS_QUERY_KEY,
    queryFn: () => fetchRedeemablePoints(clubId!),
    enabled: enabled && !!clubId,
  });
}
