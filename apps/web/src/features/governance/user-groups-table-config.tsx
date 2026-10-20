import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { UserGroupSummary } from '@hris/shared-types';

export const USER_GROUP_VIEWS_STORAGE_KEY = 'hris:user-groups:views';

export const USER_GROUP_SEARCH_TEXT = (group: UserGroupSummary): string =>
  `${group.name} ${group.description ?? ''}`;

export function buildUserGroupFilters(
  _rows: readonly UserGroupSummary[],
): readonly DataTableFilter<UserGroupSummary>[] {
  return [];
}

export const USER_GROUP_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All groups',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

export function buildUserGroupColumns({
  onDelete,
}: {
  readonly onDelete: (group: UserGroupSummary) => void;
}): readonly DataTableColumn<UserGroupSummary>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      sortValue: (group) => group.name,
      cell: (group) => <span className="font-medium">{group.name}</span>,
    },
    {
      id: 'description',
      header: 'Description',
      sortValue: (group) => group.description ?? '',
      responsive: 'hidden md:table-cell',
      cellClassName: 'text-muted-foreground',
      cell: (group) => group.description ?? '—',
    },
    {
      id: 'members',
      header: 'Members',
      sortValue: (group) => group.memberCount,
      cellClassName: 'font-mono',
      cell: (group) => group.memberCount,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      align: 'right',
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (group) => (
        <Button variant="outline" size="sm" onClick={() => onDelete(group)}>
          <Trash2 className="mr-1 size-4" aria-hidden />
          Delete
        </Button>
      ),
    },
  ];
}
