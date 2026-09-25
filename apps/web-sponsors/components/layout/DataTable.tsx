'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyHint } from '@/components/layout/PageShell';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  empty,
  onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyHint>{empty || 'Sin datos.'}</EmptyHint>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  'h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
                  col.className,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                'transition-colors duration-150',
                onRowClick && 'cursor-pointer hover:bg-primary/5',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={cn('py-3', col.className)}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
