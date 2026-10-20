import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AccessReviewSummary } from '@hris/shared-types';

export const ACCESS_REVIEW_VIEWS_STORAGE_KEY = 'hris:access-reviews:views';

export const ACCESS_REVIEW_SEARCH_TEXT = (review: AccessReviewSummary): string =>
  `${review.name} ${review.scope} ${review.reviewerId}`;

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'secondary'> = {
  COMPLETED: 'success',
  IN_PROGRESS: 'warning',
  PENDING: 'default',
};

export function buildAccessReviewFilters(
  rows: readonly AccessReviewSummary[],
): readonly DataTableFilter<AccessReviewSummary>[] {
  const statuses = [...new Set(rows.map((r) => r.status))].sort();
  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (review) => review.status,
      options: statuses.map((status) => ({ value: status, label: status })),
    },
  ];
}

export const ACCESS_REVIEW_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All reviews',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

export function buildAccessReviewColumns({
  onOpen,
}: {
  readonly onOpen: (review: AccessReviewSummary) => void;
}): readonly DataTableColumn<AccessReviewSummary>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      sortValue: (review) => review.name,
      cell: (review) => <span className="font-medium">{review.name}</span>,
    },
    {
      id: 'scope',
      header: 'Scope',
      sortValue: (review) => review.scope,
      responsive: 'hidden md:table-cell',
      cellClassName: 'text-sm text-muted-foreground',
      cell: (review) => review.scope,
    },
    {
      id: 'reviewer',
      header: 'Reviewer',
      sortValue: (review) => review.reviewerId,
      responsive: 'hidden md:table-cell',
      cellClassName: 'font-mono text-sm text-muted-foreground',
      cell: (review) => review.reviewerId,
    },
    {
      id: 'progress',
      header: 'Progress',
      sortValue: (review) => review.decidedCount,
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (review) => `${review.decidedCount} / ${review.itemCount}`,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (review) => review.status,
      cell: (review) => (
        <Badge variant={STATUS_VARIANT[review.status] ?? 'default'}>{review.status}</Badge>
      ),
    },
    {
      id: 'due',
      header: 'Due',
      sortValue: (review) => review.dueAt ?? '',
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (review) => review.dueAt ?? '—',
    },
    {
      id: 'actions',
      header: <span className="sr-only">Open</span>,
      hideable: false,
      align: 'right',
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (review) => (
        <Button variant="outline" size="sm" onClick={() => onOpen(review)}>
          Open
        </Button>
      ),
    },
  ];
}
