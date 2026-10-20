'use client';

import type { ReactNode } from 'react';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import type { Paginated } from '@hris/shared-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A server-paged list on top of the shared table, with the client-side half switched off
 * on purpose.
 *
 * The request log and the usage report ask the API for one page — or one rollup — at a
 * time, so a client-side sort would reorder the rows in hand and present that as the
 * order of the log, and a client-side search would answer "nothing matches" about records
 * it never asked for. Both would be confidently wrong, so the shared table is used for
 * what it does honestly here: the same chrome as every other list, consistent loading,
 * empty and error states, column visibility, and one place for the page's own controls.
 * Filtering stays a server query — passed through `actions`, the toolbar's right-hand
 * slot — and paging stays the API's cursor, rendered under the table.
 */
export function ServerPagedTable<TRow extends { readonly id: string }>({
  rows,
  columns,
  actions,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  pageInfo,
  historyLength,
  onPrevious,
  onNext,
}: {
  readonly rows: readonly TRow[];
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly actions?: ReactNode;
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly onRetry: () => void;
  readonly emptyTitle: string;
  readonly emptyDescription?: string;
  /** Absent for reports that are not paginated, which then render no pager at all. */
  readonly pageInfo?: Paginated<never>['pageInfo'];
  readonly historyLength?: number;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
}) {
  return (
    <>
      <HrisDataTable
        rows={rows}
        columns={columns}
        searchable={false}
        selectable={false}
        pagination={false}
        actions={actions}
        status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
        errorCopy={error}
        onRetry={onRetry}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />

      {pageInfo !== undefined && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" disabled={historyLength === 0} onClick={() => onPrevious?.()}>
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>
          <Button variant="outline" disabled={!pageInfo.hasNextPage} onClick={() => onNext?.()}>
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </>
  );
}
