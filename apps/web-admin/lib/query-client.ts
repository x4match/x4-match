import { MutationCache, QueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      successMessage?: string;
      errorMessage?: string;
      silent?: boolean;
    };
  }
}

export function makeQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = mutation.meta?.successMessage;
        if (message) toast.success(message);
      },
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        const fallback = mutation.meta?.errorMessage ?? 'No se pudo completar la acción';
        toast.error(getApiErrorMessage(error, fallback));
      },
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
      mutations: {
        meta: { errorMessage: 'No se pudo completar la acción' },
      },
    },
  });
}
