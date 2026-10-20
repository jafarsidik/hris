import {
  EMPTY_FILTERS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { LeaveRequest } from './leave-types';

/**
 * The leave requests table's contract: which columns it shows, how it filters,
 * and which views it offers. Kept apart from {@link LeaveRequestsScreen} so the
 * screen stays about behaviour, exactly as the users directory splits the same
 * concerns.
 */

export const LEAVE_REQUESTS_VIEWS_STORAGE_KEY = 'hris:leave-requests:views';

/** The free text a row matches against. */
export const LEAVE_REQUESTS_SEARCH_TEXT = (request: LeaveRequest): string =>
  [request.employeeName, request.employeeNumber, request.leaveTypeName].join(' ');

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

function statusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning">Pending</Badge>;
    case 'APPROVED':
      return <Badge variant="success">Approved</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'CANCELLED':
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * The filters the toolbar shows.
 *
 * The status vocabulary is always offered, unioned with whatever the rows
 * actually carry — the same rule the users directory follows.
 */
export function buildLeaveRequestsFilters(
  rows: readonly LeaveRequest[],
): readonly DataTableFilter<LeaveRequest>[] {
  const present = new Set<string>([...STATUS_OPTIONS, ...rows.map((row) => row.status)]);
  const statusOptions = [...present].map((status) => ({
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase(),
  }));

  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (request) => request.status,
      options: statusOptions,
    },
  ];
}

/**
 * The columns.
 *
 * No actions column: the requests screen is read-only, so there is no row menu
 * to pin.
 */
export function buildLeaveRequestsColumns(): readonly DataTableColumn<LeaveRequest>[] {
  return [
    {
      id: 'employee',
      header: 'Employee',
      sortValue: (request) => request.employeeName,
      cell: (request) => (
        <div className="flex flex-col">
          <span className="font-medium">{request.employeeName}</span>
          <span className="text-xs text-muted-foreground">{request.employeeNumber}</span>
        </div>
      ),
    },
    {
      id: 'leaveType',
      header: 'Leave type',
      sortValue: (request) => request.leaveTypeName,
      cell: (request) => <span className="font-mono text-sm">{request.leaveTypeName}</span>,
    },
    {
      id: 'dates',
      header: 'From → To',
      align: 'center',
      sortValue: (request) => request.startDate,
      cell: (request) => (
        <span className="font-mono text-sm">
          {formatWhen(request.startDate)} → {formatWhen(request.endDate)}
        </span>
      ),
    },
    {
      id: 'days',
      header: 'Days',
      align: 'center',
      sortValue: (request) => request.days,
      cell: (request) => <span className="font-mono text-sm">{request.days}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (request) => request.status,
      cell: (request) => statusBadge(request.status),
    },
  ];
}

const withStatus = (status: string) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the requests list ships with. */
export const LEAVE_REQUESTS_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All requests',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'pending', name: 'Pending', builtIn: true, state: withStatus('PENDING') },
  { id: 'approved', name: 'Approved', builtIn: true, state: withStatus('APPROVED') },
  { id: 'rejected', name: 'Rejected', builtIn: true, state: withStatus('REJECTED') },
  { id: 'cancelled', name: 'Cancelled', builtIn: true, state: withStatus('CANCELLED') },
];
