import {
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { OutboxEventSummary } from '@hris/shared-types';
import { EventRowMenu } from './event-row-menu';

/**
 * The recent-history table's contract: which columns it shows.
 *
 * The history is server-paged — the registry endpoint takes `limit`, `resource`,
 * `pendingOnly` and `type` and returns a cursor-bounded slice — so the shared table is
 * wired with `searchable={false}`, no `sortValue` and `pagination={false}`: client-side
 * search, sort or paging over a server slice would show a partial list as if it were
 * the whole. The server controls (rows-per-page, refresh, resource filter, pending-only)
 * stay in the card header, above the table.
 */

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

/**
 * The columns.
 *
 * No column declares a `sortValue`: the rows are a server slice, so sorting them
 * client-side would reorder a page as if it were the whole history.
 *
 * `canRetry` gates the actions column: a reader without `workflow.manage` gets no
 * actions column at all, rather than a retry button that silently does nothing.
 */
export function buildEventColumns({
  canRetry,
  onRetry,
}: {
  readonly canRetry: boolean;
  readonly onRetry: (id: string) => void;
}): readonly DataTableColumn<OutboxEventSummary>[] {
  const columns: DataTableColumn<OutboxEventSummary>[] = [
    {
      id: 'type',
      header: 'Type',
      cellClassName: 'font-mono font-medium',
      cell: (event) => event.type,
    },
    {
      id: 'resource',
      header: 'Resource',
      cellClassName: 'text-muted-foreground',
      cell: (event) => `${event.resource}/${event.resourceId}`,
    },
    {
      id: 'occurred',
      header: 'Occurred',
      cell: (event) => formatTimestamp(event.occurredAt),
    },
    {
      id: 'delivered',
      header: 'Delivered',
      cell: (event) =>
        event.publishedAt !== null ? (
          <span className="text-muted-foreground">{formatTimestamp(event.publishedAt)}</span>
        ) : (
          <Badge variant="warning">Pending</Badge>
        ),
    },
    {
      id: 'attempts',
      header: 'Attempts',
      align: 'right',
      cellClassName: 'font-mono',
      cell: (event) => event.attempts,
    },
  ];

  if (canRetry) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (event) => <EventRowMenu event={event} onRetry={onRetry} />,
    });
  }

  return columns;
}
