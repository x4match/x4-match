export const DEFAULT_PAGE_SIZE = 25;

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export function getTotalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function getPageRange(page: number, pageSize: number, total: number) {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { from, to };
}
