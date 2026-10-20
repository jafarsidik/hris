import { EMPTY_FILTERS, type DataTableColumn, type DataTableView } from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { LeaveType } from './leave-types';

/**
 * The leave types table's contract: which columns it shows and which views it
 * offers. Kept apart from {@link LeaveTypesScreen} so the screen stays about
 * behaviour, exactly as the users directory splits the same concerns.
 */

export const LEAVE_TYPES_VIEWS_STORAGE_KEY = 'hris:leave-types:views';

/** The free text a row matches against. */
export const LEAVE_TYPES_SEARCH_TEXT = (type: LeaveType): string =>
  [type.code, type.name, type.description ?? ''].join(' ');

/**
 * The columns.
 *
 * No actions column: the types screen is read-only, so there is no row menu
 * to pin.
 */
export function buildLeaveTypesColumns(): readonly DataTableColumn<LeaveType>[] {
  return [
    {
      id: 'code',
      header: 'Code',
      sortValue: (type) => type.code,
      cell: (type) => <span className="font-mono text-sm">{type.code}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (type) => type.name,
      cell: (type) => <span className="font-medium">{type.name}</span>,
    },
    {
      id: 'description',
      header: 'Description',
      sortValue: (type) => type.description ?? '',
      responsive: 'hidden md:table-cell',
      cellClassName: 'max-w-[20rem] truncate text-sm',
      cell: (type) => (
        <span className="block truncate" title={type.description ?? undefined}>
          {type.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'paid',
      header: 'Paid',
      sortValue: (type) => (type.isPaid ? 'Paid' : 'Unpaid'),
      cell: (type) =>
        type.isPaid ? (
          <Badge variant="success">Paid</Badge>
        ) : (
          <Badge variant="outline">Unpaid</Badge>
        ),
    },
    {
      id: 'defaultDays',
      header: 'Default days',
      align: 'center',
      sortValue: (type) => type.defaultDays,
      cell: (type) => <span className="font-mono text-sm">{type.defaultDays}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (type) => (type.isActive ? 'Active' : 'Inactive'),
      cell: (type) =>
        type.isActive ? (
          <Badge variant="secondary">Active</Badge>
        ) : (
          <Badge variant="outline">Inactive</Badge>
        ),
    },
  ];
}

/** Views the types list ships with. */
export const LEAVE_TYPES_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All types',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];
