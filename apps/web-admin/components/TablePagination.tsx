'use client';

import { getPageRange, getTotalPages } from '@/lib/table-pagination';

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
};

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  isLoading,
}: TablePaginationProps) {
  const totalPages = getTotalPages(total, pageSize);
  const { from, to } = getPageRange(page, pageSize, total);

  if (total === 0) return null;

  return (
    <div className="table-pagination">
      <span className="table-pagination-summary">
        {isLoading ? 'Cargando…' : `Mostrando ${from}–${to} de ${total}`}
      </span>

      {totalPages > 1 ? (
        <div className="table-pagination-controls">
          <button
            className="btn btn-outline table-pagination-btn"
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </button>
          <span className="table-pagination-page">
            Página {page} de {totalPages}
          </span>
          <button
            className="btn btn-outline table-pagination-btn"
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </div>
  );
}
