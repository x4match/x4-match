import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type FeatureFlags = { circuits: boolean };

const DISABLED: FeatureFlags = { circuits: false };

/** Módulos activos según el backend (variables de entorno de la API). Ante error, todo pausado. */
export function useFeatureFlags() {
  const query = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async (): Promise<FeatureFlags> => {
      const res = await api.get('/features');
      return { circuits: res.data?.circuits === true };
    },
    staleTime: 5 * 60_000,
  });
  return { flags: query.data ?? DISABLED, loading: query.isLoading };
}

/** Mientras sea false, el módulo de circuitos se muestra como "en construcción". */
export function useCircuitsEnabled(): boolean {
  return useFeatureFlags().flags.circuits;
}
