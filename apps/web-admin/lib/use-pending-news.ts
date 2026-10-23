import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePendingNews() {
  return useQuery({
    queryKey: ['platform-news-pending'],
    queryFn: async () => {
      const res = await api.get('/platform/news', { params: { status: 'PENDING', limit: 1 } });
      return Number(res.data?.pendingTotal ?? res.data?.total ?? 0);
    },
    refetchInterval: 60_000,
  });
}
