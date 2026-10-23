import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type MutedClub = {
  clubId: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  mutedAt: string;
};

export const MUTED_CLUBS_QUERY_KEY = ['muted-clubs'];

export function useMutedClubs(enabled = true) {
  return useQuery({
    queryKey: MUTED_CLUBS_QUERY_KEY,
    queryFn: async () => (await api.get('/notifications/muted-clubs')).data as MutedClub[],
    enabled,
  });
}

export function useToggleClubMute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId, muted }: { clubId: string; muted: boolean; name?: string }) => {
      if (muted) await api.put(`/notifications/muted-clubs/${clubId}`);
      else await api.delete(`/notifications/muted-clubs/${clubId}`);
    },
    onMutate: async ({ clubId, muted, name }) => {
      await queryClient.cancelQueries({ queryKey: MUTED_CLUBS_QUERY_KEY });
      const previous = queryClient.getQueryData<MutedClub[]>(MUTED_CLUBS_QUERY_KEY);
      queryClient.setQueryData<MutedClub[]>(MUTED_CLUBS_QUERY_KEY, (current = []) =>
        muted
          ? [
              ...current.filter((club) => club.clubId !== clubId),
              { clubId, name: name ?? 'Club', city: null, logoUrl: null, mutedAt: new Date().toISOString() },
            ]
          : current.filter((club) => club.clubId !== clubId),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(MUTED_CLUBS_QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MUTED_CLUBS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}
