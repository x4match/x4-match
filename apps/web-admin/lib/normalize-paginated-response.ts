import type { PaginatedResponse } from './table-pagination';
import { DEFAULT_PAGE_SIZE } from './table-pagination';

export function normalizePaginatedResponse<T>(data: unknown): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return {
      items: data as T[],
      total: data.length,
      limit: data.length,
      offset: 0,
    };
  }

  if (data && typeof data === 'object' && 'items' in data) {
    const payload = data as PaginatedResponse<T>;
    const items = Array.isArray(payload.items) ? payload.items : [];
    return {
      items,
      total: typeof payload.total === 'number' ? payload.total : items.length,
      limit: payload.limit ?? DEFAULT_PAGE_SIZE,
      offset: payload.offset ?? 0,
    };
  }

  return { items: [], total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0 };
}
