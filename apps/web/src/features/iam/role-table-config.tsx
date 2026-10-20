import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { RoleSummary } from './iam-types';
import { RoleRowMenu } from './role-row-menu';
import { Shield } from 'lucide-react';

/**
 * The roles table's contract: columns, filters and the views it offers.
 *
 * The list used to be a bare `<table>` whose rows were clickable, which is why it had no
 * sorting, no filtering, no column visibility and no per-row actions — the only way to
 * delete a role was to open it and find the button inside the editor. It now uses the same
 * table as the employee directory and the users list, so a reader gets the same controls in
 * the same places on all three.
 */

export const ROLE_VIEWS_STORAGE_KEY = 'hris:roles:views';

/** The free text a row matches against. */
export const ROLE_SEARCH_TEXT = (role: RoleSummary): string =>
  `${role.name} ${role.key} ${role.description}`;

export const ROLE_TYPE = {
  SYSTEM: 'System',
  CUSTOM: 'Custom',
} as const;

const typeOf = (role: RoleSummary): 'SYSTEM' | 'CUSTOM' => (role.isSystem ? 'SYSTEM' : 'CUSTOM');

export function buildRoleFilters(
  rows: readonly RoleSummary[],
): readonly DataTableFilter<RoleSummary>[] {
  // Both options are always offered, even when the tenant has no custom roles yet: the
  // filter is how a reader looks for a category, and hiding a category because it is empty
  // answers "nothing here" with "no such thing".
  void rows;

  return [
    {
      kind: 'select',
      id: 'type',
      label: 'Type',
      placeholder: 'All types',
      getValue: (role) => typeOf(role),
      options: [
        { value: 'SYSTEM', label: ROLE_TYPE.SYSTEM },
        { value: 'CUSTOM', label: ROLE_TYPE.CUSTOM },
      ],
    },
  ];
}

const withType = (type: 'SYSTEM' | 'CUSTOM') => ({
  filters: { ...EMPTY_FILTERS, select: { type } },
  search: '',
});

/** Views the roles list ships with; the first is the default. */
export const ROLE_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All roles',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'system', name: 'System roles', builtIn: true, state: withType('SYSTEM') },
  { id: 'custom', name: 'Custom roles', builtIn: true, state: withType('CUSTOM') },
];

/**
 * The columns.
 *
 * The role name is a button rather than a row-wide click target: the shared table keeps rows
 * non-clickable so selecting one for bulk work does not fire a navigation, which is the same
 * reason the employee directory links from its name cell instead.
 */
export function buildRoleColumns({
  onOpen,
  onDelete,
}: {
  onOpen: (role: RoleSummary) => void;
  onDelete: (role: RoleSummary) => void;
}): readonly DataTableColumn<RoleSummary>[] {
  return [
    {
      id: 'role',
      header: 'Role',
      sortValue: (role) => role.name,
      cell: (role) => (
        <div className="flex flex-col items-start">
          <button
            type="button"
            onClick={() => onOpen(role)}
            className="rounded-sm text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {role.name}
          </button>
          <span className="font-mono text-xs text-muted-foreground">{role.key}</span>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      sortValue: (role) => typeOf(role),
      cell: (role) =>
        role.isSystem ? (
          <Badge variant="secondary">
            <Shield aria-hidden="true" className="size-3" />
            System
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Custom</span>
        ),
    },
    {
      id: 'description',
      header: 'Description',
      sortValue: (role) => role.description,
      responsive: 'hidden lg:table-cell',
      cellClassName: 'max-w-[24rem] text-muted-foreground',
      cell: (role) => (
        <span className="block truncate" title={role.description}>
          {role.description}
        </span>
      ),
    },
    {
      id: 'members',
      header: 'Members',
      sortValue: (role) => role.memberCount,
      align: 'right',
      cellClassName: 'tabular-nums',
      cell: (role) => role.memberCount,
    },
    {
      id: 'permissions',
      header: 'Permissions',
      sortValue: (role) => role.permissionCount,
      align: 'right',
      cellClassName: 'tabular-nums',
      cell: (role) => role.permissionCount,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (role) => <RoleRowMenu role={role} onOpen={onOpen} onDelete={onDelete} />,
    },
  ];
}
