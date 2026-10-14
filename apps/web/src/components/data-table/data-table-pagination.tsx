'use client';

import { Pagination, PaginationSummary } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * The paging footer.
 *
 * Unpaginated tables (a small fixed list) skip this entirely; the brief's dense
 * directory always paginates, over however many rows were handed to the client. The
 * numbers come from `pageSize` and the row count the table actually holds.
 */
export function DataTablePagination({
  pageIndex,
  pageCount,
  from,
  to,
  total,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: {
  pageIndex: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
      <div className="flex items-center gap-2">
        <label htmlFor="data-table-page-size" className="text-sm text-muted-foreground">
          Rows per page
        </label>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger id="data-table-page-size" size="sm" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <PaginationSummary from={from} to={to} total={total} />

      <Pagination pageIndex={pageIndex} pageCount={pageCount} onPageChange={onPageChange} />
    </div>
  );
}
