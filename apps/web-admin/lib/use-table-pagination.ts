'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from './table-pagination';

export function useTablePagination(pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const offset = (page - 1) * pageSize;

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  return { page, setPage, pageSize, offset, resetPage };
}

export function useResetPageOnChange(resetPage: () => void, deps: unknown) {
  useEffect(() => {
    resetPage();
  }, [resetPage, deps]);
}
