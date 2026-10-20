import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { ScheduledActionSummary } from '@hris/shared-types';
import { ScheduledActionRowMenu } from './scheduled-action-row-menu';

/**
 * The scheduled-actions table's contract: which columns it shows, how it filters, and
 * which views it offers. Kept apart from the screen so the screen stays about behaviour,
 * the same split the users and roles lists use.
 *
 * The list used to be a hand-rolled `<table>` inside a card, with a skeleton and an empty
 * state the screen owned. It now uses the shared table, so it gains sorting, filtering,
 * column visibility, saved views and a pinned row menu at once.
 */

export const SCHEDULED_ACTION_VIEWS_STORAGE_KEY = 'hris:scheduled-actions:views';

/** The free text a row matches against. */
export const SCHEDULED_ACTION_SEARCH_TEXT = (row: ScheduledActionSummary): string =>
  [row.name, row.cron, row.description ?? ''].join(' ');

const STATE_LABEL = { ENABLED: 'Enabled', DISABLED: 'Disabled' } as const;

/**
 * The filters the toolbar shows.
 *
 * Both states are always offered, even when every action is in one of them: the filter
 * is how a reader looks for a category, and hiding a category because it is empty
 * answers "nothing here" with "no such thing".
 */
export function buildScheduledActionFilters(
  rows: readonly ScheduledActionSummary[],
): readonly DataTableFilter<ScheduledActionSummary>[] {
  void rows;

  return [
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (row) => (row.isEnabled ? 'ENABLED' : 'DISABLED'),
      options: [
        { value: 'ENABLED', label: STATE_LABEL.ENABLED },
        { value: 'DISABLED', label: STATE_LABEL.DISABLED },
      ],
    },
  ];
}

const withState = (state: 'ENABLED' | 'DISABLED') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

/** Views the list ships with; the first is the default. */
export const SCHEDULED_ACTION_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All actions',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'enabled', name: 'Enabled', builtIn: true, state: withState('ENABLED') },
  { id: 'disabled', name: 'Disabled', builtIn: true, state: withState('DISABLED') },
];

/**
 * The columns.
 *
 * `onToggle`, `onRunNow` and `onDelete` are optional on purpose: a reader without
 * `workflow.manage` gets no actions column at all, rather than a column of controls that
 * are disabled or that silently do nothing. The menu itself is the only writer, so the
 * permission question is asked once, by the screen.
 */
export function buildScheduledActionColumns({
  onToggle,
  onRunNow,
  onDelete,
}: {
  onToggle?: (row: ScheduledActionSummary) => void;
  onRunNow?: (id: string) => void;
  onDelete?: (row: ScheduledActionSummary) => void;
}): readonly DataTableColumn<ScheduledActionSummary>[] {
  const columns: DataTableColumn<ScheduledActionSummary>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (row) => row.name,
      cellClassName: 'font-medium',
      cell: (row) => row.name,
    },
    {
      id: 'cron',
      header: 'Cron',
      sortValue: (row) => row.cron,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.cron,
    },
    {
      id: 'nextRun',
      header: 'Next run',
      sortValue: (row) => row.nextRunAt ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (row) => row.nextRunAt ?? '—',
    },
    {
      id: 'lastRun',
      header: 'Last run',
      sortValue: (row) => row.lastRunAt ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (row) => row.lastRunAt ?? '—',
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (row) => (row.isEnabled ? 'ENABLED' : 'DISABLED'),
      cell: (row) => (
        <Badge variant={row.isEnabled ? 'success' : 'secondary'}>
          {row.isEnabled ? 'ENABLED' : 'DISABLED'}
        </Badge>
      ),
    },
  ];

  if (onToggle !== undefined && onRunNow !== undefined && onDelete !== undefined) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => (
        <ScheduledActionRowMenu
          row={row}
          onToggle={onToggle}
          onRunNow={onRunNow}
          onDelete={onDelete}
        />
      ),
    });
  }

  return columns;
}
