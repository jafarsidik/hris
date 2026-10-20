'use client';

import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { ServiceAccountSummary } from '@hris/shared-types';
import { MoreHorizontalIcon, Trash2, UserCheckIcon, UserXIcon } from 'lucide-react';

export const SERVICE_ACCOUNT_VIEWS_STORAGE_KEY = 'hris:service-accounts:views';

export const SERVICE_ACCOUNT_SEARCH_TEXT = (account: ServiceAccountSummary): string =>
  `${account.name} ${account.key}`;

export function buildServiceAccountFilters(
  _rows: readonly ServiceAccountSummary[],
): readonly DataTableFilter<ServiceAccountSummary>[] {
  return [
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (account) => (account.isActive ? 'ACTIVE' : 'INACTIVE'),
      options: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' },
      ],
    },
  ];
}

export const SERVICE_ACCOUNT_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All accounts',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

export function buildServiceAccountColumns({
  canManage,
  onRotate,
  onToggle,
  onDelete,
}: {
  readonly canManage: boolean;
  readonly onRotate: (account: ServiceAccountSummary) => void;
  readonly onToggle: (account: ServiceAccountSummary) => void;
  readonly onDelete: (account: ServiceAccountSummary) => void;
}): readonly DataTableColumn<ServiceAccountSummary>[] {
  const columns: DataTableColumn<ServiceAccountSummary>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (account) => account.name,
      cell: (account) => <span className="font-medium">{account.name}</span>,
    },
    {
      id: 'key',
      header: 'Key',
      sortValue: (account) => account.key,
      cellClassName: 'font-mono text-sm',
      cell: (account) => account.key,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (account) => (account.isActive ? 'ACTIVE' : 'INACTIVE'),
      cell: (account) => (
        <Badge variant={account.isActive ? 'success' : 'secondary'}>
          {account.isActive ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      id: 'expires',
      header: 'Expires',
      sortValue: (account) => account.expiresAt ?? '',
      cellClassName: 'font-mono text-sm',
      cell: (account) => account.expiresAt ?? '—',
    },
  ];

  if (canManage) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      align: 'right',
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (account) => (
        <ServiceAccountRowMenu
          account={account}
          onRotate={onRotate}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ),
    });
  }

  return columns;
}

function ServiceAccountRowMenu({
  account,
  onRotate,
  onToggle,
  onDelete,
}: {
  readonly account: ServiceAccountSummary;
  readonly onRotate: (account: ServiceAccountSummary) => void;
  readonly onToggle: (account: ServiceAccountSummary) => void;
  readonly onDelete: (account: ServiceAccountSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${account.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onRotate(account)}>Rotate secret</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggle(account)}>
          {account.isActive ? (
            <>
              <UserXIcon aria-hidden="true" className="size-4" />
              Disable
            </>
          ) : (
            <>
              <UserCheckIcon aria-hidden="true" className="size-4" />
              Enable
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(account)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
