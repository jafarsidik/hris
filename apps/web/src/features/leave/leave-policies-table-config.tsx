import { EMPTY_FILTERS, type DataTableColumn, type DataTableView } from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { LeavePolicy } from './leave-types';

/**
 * The leave policies table's contract: which columns it shows and which views it
 * offers. Kept apart from {@link LeavePoliciesScreen} so the screen stays about
 * behaviour, exactly as the users directory splits the same concerns.
 */

export const LEAVE_POLICIES_VIEWS_STORAGE_KEY = 'hris:leave-policies:views';

/** The free text a row matches against. */
export const LEAVE_POLICIES_SEARCH_TEXT = (policy: LeavePolicy): string =>
  [policy.leaveTypeName].join(' ');

/**
 * The columns.
 *
 * No actions column: the policies screen is read-only, so there is no row menu
 * to pin.
 */
export function buildLeavePoliciesColumns(): readonly DataTableColumn<LeavePolicy>[] {
  return [
    {
      id: 'leaveType',
      header: 'Leave type',
      sortValue: (policy) => policy.leaveTypeName,
      cell: (policy) => <span className="font-medium">{policy.leaveTypeName}</span>,
    },
    {
      id: 'annualDays',
      header: 'Annual days',
      align: 'center',
      sortValue: (policy) => policy.annualDays,
      cell: (policy) => <span className="font-mono text-sm">{policy.annualDays}</span>,
    },
    {
      id: 'carryForward',
      header: 'Carry forward',
      sortValue: (policy) => (policy.carryForward ? 'Carries forward' : 'Use it or lose it'),
      cell: (policy) =>
        policy.carryForward ? (
          <Badge variant="secondary">Carries forward</Badge>
        ) : (
          <Badge variant="outline">Use it or lose it</Badge>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (policy) => (policy.isActive ? 'Active' : 'Inactive'),
      cell: (policy) =>
        policy.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="outline">Inactive</Badge>
        ),
    },
  ];
}

/** Views the policies list ships with. */
export const LEAVE_POLICIES_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All policies',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];
