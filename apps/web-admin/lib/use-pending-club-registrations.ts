import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePendingClubRegistrations() {
  return useQuery({
    queryKey: ['platform-club-registrations-pending'],
    queryFn: async () => {
      const res = await api.get('/platform/club-registrations', {
        params: { status: 'PENDING', limit: 1 },
      });
      return Number(res.data?.total ?? 0);
    },
    refetchInterval: 60_000,
  });
}
