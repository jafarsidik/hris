import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { UserSummary } from './iam-types';
import { UserRowMenu } from './user-row-menu';

/**
 * The users table's contract: which columns it shows, how it filters, and which views it
 * offers. Kept apart from {@link UsersScreen} so the screen stays about behaviour, exactly
 * as the employee directory splits the same concerns.
 *
 * Before this existed the screen hand-rolled its own `<table>` with a search box and a
 * status dropdown bolted above it, which is why it had no sorting, no pagination, no column
 * visibility, no row menu and no empty state beyond a table row that said "No users match
 * this filter." The shared table brings all of that at once, and the two directories now
 * behave identically.
 */

export const USER_VIEWS_STORAGE_KEY = 'hris:users:views';

/** The free text a row matches against; every column a reader would search by. */
export const USER_SEARCH_TEXT = (user: UserSummary): string =>
  [
    user.displayName,
    user.email,
    user.organizationalUnit?.name ?? '',
    ...user.roles.map((role) => role.name),
  ].join(' ');

const STATUS_VARIANT: Record<
  UserSummary['status'],
  'default' | 'secondary' | 'warning' | 'destructive'
> = {
  ACTIVE: 'default',
  INVITED: 'secondary',
  SUSPENDED: 'warning',
  DISABLED: 'destructive',
};

/**
 * The status labels as a reader would say them.
 *
 * The API returns the code (`SUSPENDED`); a table column headed "Status" showing a bare
 * enum is the sort of thing that makes an administration console feel like a database
 * client. The code stays the sort key and the filter value, so nothing about the data
 * changes.
 */
const STATUS_LABEL: Record<UserSummary['status'], string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
  DISABLED: 'Disabled',
};

const STATUSES: readonly UserSummary['status'][] = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED'];

function humanDate(value: string | null): string {
  if (value === null) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * The filters the toolbar shows.
 *
 * The status vocabulary is always offered, unioned with whatever the rows actually carry —
 * the same rule the employee directory follows. Deriving it from the rows alone would make
 * the filter list change shape as data changes, so "show me the suspended accounts" could
 * disappear at exactly the moment there are none, and the option a reader was looking for
 * would be missing rather than empty.
 */
export function buildUserFilters(
  rows: readonly UserSummary[],
): readonly DataTableFilter<UserSummary>[] {
  const present = new Set<UserSummary['status']>([...STATUSES, ...rows.map((user) => user.status)]);
  const statusOptions = [...present].map((status) => ({
    value: status,
    label: STATUS_LABEL[status] ?? status,
  }));

  const units = [
    ...new Set(
      rows
        .map((user) => user.organizationalUnit?.name)
        .filter((name): name is string => name !== undefined && name !== ''),
    ),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ value: name, label: name }));

  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (user) => user.status,
      options: statusOptions,
    },
    {
      kind: 'select',
      id: 'unit',
      label: 'Unit',
      placeholder: 'All units',
      getValue: (user) => user.organizationalUnit?.name ?? '',
      advanced: true,
      options: units,
    },
  ];
}

const withStatus = (status: UserSummary['status']) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the users list ships with; the first is the default. */
export const USER_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All users',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'active', name: 'Active', builtIn: true, state: withStatus('ACTIVE') },
  { id: 'suspended', name: 'Suspended', builtIn: true, state: withStatus('SUSPENDED') },
  { id: 'disabled', name: 'Disabled', builtIn: true, state: withStatus('DISABLED') },
];

/**
 * The columns.
 *
 * `onChangeStatus` is optional on purpose: a reader without `user.update` gets no actions
 * column at all, rather than a column of controls that are disabled or that silently do
 * nothing. The menu itself is the only writer, so the permission question is asked once, by
 * the screen.
 */
export function buildUserColumns({
  onChangeStatus,
}: {
  onChangeStatus?: (user: UserSummary) => void;
}): readonly DataTableColumn<UserSummary>[] {
  const columns: DataTableColumn<UserSummary>[] = [
    {
      id: 'user',
      header: 'User',
      sortValue: (user) => user.displayName,
      cell: (user) => (
        <div className="flex flex-col">
          <span className="font-medium">{user.displayName}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (user) => user.status,
      cell: (user) => (
        <Badge variant={STATUS_VARIANT[user.status]}>{STATUS_LABEL[user.status]}</Badge>
      ),
    },
    {
      id: 'unit',
      header: 'Unit',
      sortValue: (user) => user.organizationalUnit?.name ?? '',
      responsive: 'hidden md:table-cell',
      cellClassName: 'max-w-[12rem] text-muted-foreground',
      cell: (user) => (
        <span className="block truncate" title={user.organizationalUnit?.name ?? undefined}>
          {user.organizationalUnit?.name ?? '—'}
        </span>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      sortValue: (user) => user.roles.map((role) => role.name).join(', '),
      responsive: 'hidden lg:table-cell',
      cellClassName: 'max-w-[16rem]',
      cell: (user) =>
        user.roles.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role.key} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      id: 'lastLogin',
      header: 'Last login',
      sortValue: (user) => user.lastLoginAt ?? '',
      responsive: 'hidden lg:table-cell',
      cellClassName: 'whitespace-nowrap tabular-nums text-muted-foreground',
      cell: (user) => humanDate(user.lastLoginAt),
    },
  ];

  if (onChangeStatus !== undefined) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (user) => <UserRowMenu user={user} onChangeStatus={onChangeStatus} />,
    });
  }

  return columns;
}
