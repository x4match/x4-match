'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { normalizePaginatedResponse } from '@/lib/normalize-paginated-response';
import { DEFAULT_PAGE_SIZE, type PaginatedResponse } from '@/lib/table-pagination';
import { useResetPageOnChange, useTablePagination } from '@/lib/use-table-pagination';
import { useTableFilters } from '@/lib/use-table-filters';

type UsePaginatedPlatformListOptions<T extends Record<string, string>> = {
  endpoint: string;
  queryKey: string;
  defaultFilters: T;
  pageSize?: number;
};

export function usePaginatedPlatformList<T extends Record<string, string>>({
  endpoint,
  queryKey,
  defaultFilters,
  pageSize = DEFAULT_PAGE_SIZE,
}: UsePaginatedPlatformListOptions<T>) {
  const { filters, setFilter, resetFilters, hasActiveFilters, apiParams } = useTableFilters(defaultFilters);
  const { page, setPage, offset, resetPage } = useTablePagination(pageSize);

  useResetPageOnChange(resetPage, JSON.stringify(apiParams));

  const query: UseQueryResult<PaginatedResponse<unknown>> = useQuery({
    queryKey: [queryKey, apiParams, page, pageSize],
    queryFn: async () => {
      const response = await api.get(endpoint, {
        params: { limit: pageSize, offset, ...apiParams },
      });
      return normalizePaginatedResponse(response.data);
    },
  });

  const data = query.data;
  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  const resetAll = () => {
    resetFilters();
    resetPage();
  };

  const errorMessage = query.isError ? getApiErrorMessage(query.error) : null;

  return {
    filters,
    setFilter,
    resetFilters: resetAll,
    hasActiveFilters,
    page,
    setPage,
    pageSize,
    total,
    items,
    errorMessage,
    ...query,
  };
}
