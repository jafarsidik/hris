import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Button } from '@/components/ui/button';

export const ACCESS_POLICY_VIEWS_STORAGE_KEY = 'hris:access-policies:views';

export interface AccessPolicyRow {
  readonly id: string;
  readonly resource: string;
  readonly actions: readonly string[];
}

export const ACCESS_POLICY_SEARCH_TEXT = (row: AccessPolicyRow): string =>
  `${row.resource} ${row.actions.join(' ')}`;

export function buildAccessPolicyFilters(
  _rows: readonly AccessPolicyRow[],
): readonly DataTableFilter<AccessPolicyRow>[] {
  return [];
}

export const ACCESS_POLICY_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All resources',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

export function buildAccessPolicyColumns({
  canManage,
}: {
  readonly canManage: boolean;
}): readonly DataTableColumn<AccessPolicyRow>[] {
  const columns: DataTableColumn<AccessPolicyRow>[] = [
    {
      id: 'resource',
      header: 'Resource',
      sortValue: (row) => row.resource,
      cell: (row) => <span className="font-medium">{row.resource}</span>,
    },
    {
      id: 'actions',
      header: 'Allowed actions',
      sortValue: (row) => row.actions.join(', '),
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.actions.join(', '),
    },
  ];

  if (canManage) {
    columns.push({
      id: 'manage',
      header: <span className="sr-only">Manage</span>,
      hideable: false,
      align: 'right',
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: () => (
        <Button variant="outline" size="sm" onClick={() => {}}>
          Edit grants
        </Button>
      ),
    });
  }

  return columns;
}
