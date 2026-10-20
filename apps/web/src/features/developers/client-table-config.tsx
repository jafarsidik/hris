import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';

import { ClientRowMenu } from './client-row-menu';
import type { DeveloperApiClient } from './developer-types';

/**
 * The API clients table's contract: which columns it shows, how it filters, and which
 * views it offers. Kept apart from {@link ClientsScreen} so the screen stays about
 * behaviour, exactly as the users directory splits the same concerns.
 *
 * The screen hand-rolled its own `<table>` with four inline buttons per row and no
 * search, sort, pagination or column visibility. The shared table brings all of that;
 * the row's controls moved into a menu so the actions column stays pinned at one kebab's
 * width instead of four buttons that pushed the table wider than the window.
 */

export const CLIENT_VIEWS_STORAGE_KEY = 'hris:clients:views';

/** The free text a row matches against; every column a reader would search by. */
export const CLIENT_SEARCH_TEXT = (client: DeveloperApiClient): string =>
  [client.name, client.clientId, client.description ?? '', ...client.scopes].join(' ');

/** The shared "never / date" cell format for the clients and credentials tables. */
export function formatTimestamp(value: string | null): string {
  if (value === null) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * The status vocabulary is closed — a client is active or it is not — so the filter is a
 * constant list rather than something derived from the rows, which would make the
 * filter's shape change as the data changes.
 */
export function buildClientFilters(): readonly DataTableFilter<DeveloperApiClient>[] {
  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (client) => (client.isActive ? 'ACTIVE' : 'DISABLED'),
      options: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'DISABLED', label: 'Disabled' },
      ],
    },
  ];
}

const withStatus = (status: 'ACTIVE' | 'DISABLED') => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the clients list ships with; the first is the default. */
export const CLIENT_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All clients',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'active', name: 'Active', builtIn: true, state: withStatus('ACTIVE') },
  { id: 'disabled', name: 'Disabled', builtIn: true, state: withStatus('DISABLED') },
];

/**
 * The columns.
 *
 * The actions column is added only when the reader has a mutation to perform, exactly as
 * the users directory does: a column of controls nobody may use is noise, and the menu
 * itself is the only writer, so the permission question is asked once, by the screen.
 */
export function buildClientColumns({
  canUpdate,
  canDelete,
  onEdit,
  onRotate,
  onToggleActive,
  onDelete,
}: {
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onEdit: (client: DeveloperApiClient) => void;
  readonly onRotate: (client: DeveloperApiClient) => void;
  readonly onToggleActive: (client: DeveloperApiClient) => void;
  readonly onDelete: (client: DeveloperApiClient) => void;
}): readonly DataTableColumn<DeveloperApiClient>[] {
  const columns: DataTableColumn<DeveloperApiClient>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (client) => client.name,
      cellClassName: 'font-medium',
      cell: (client) => client.name,
    },
    {
      id: 'clientId',
      header: 'Client ID',
      sortValue: (client) => client.clientId,
      cellClassName: 'font-mono text-xs',
      cell: (client) => client.clientId,
    },
    {
      id: 'scopes',
      header: 'Scopes',
      sortValue: (client) => client.scopes.length,
      cell: (client) => <Badge variant="secondary">{client.scopes.length}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (client) => (client.isActive ? 'Active' : 'Disabled'),
      cell: (client) => (
        <Badge variant={client.isActive ? 'success' : 'outline'}>
          {client.isActive ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      id: 'lastUsed',
      header: 'Last used',
      sortValue: (client) => client.lastUsedAt ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (client) => formatTimestamp(client.lastUsedAt),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      id: 'actions',
      header: 'Actions',
      align: 'right',
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (client) => (
        <ClientRowMenu
          client={client}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={onEdit}
          onRotate={onRotate}
          onToggleActive={onToggleActive}
          onDelete={onDelete}
        />
      ),
    });
  }

  return columns;
}
