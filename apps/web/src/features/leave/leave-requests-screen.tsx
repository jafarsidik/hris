'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useSession } from '@/features/auth/session-context';

import {
  LEAVE_REQUESTS_BUILT_IN_VIEWS,
  LEAVE_REQUESTS_SEARCH_TEXT,
  LEAVE_REQUESTS_VIEWS_STORAGE_KEY,
  buildLeaveRequestsColumns,
  buildLeaveRequestsFilters,
} from './leave-requests-table-config';
import type { LeaveRequest } from './leave-types';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/**
 * Leave Requests: employee leave applications and their approval status.
 *
 * Receives the first page of rows from the server page; filtering happens
 * client-side over the rows in hand.
 */
export function LeaveRequestsScreen({ initialRows }: { initialRows: readonly LeaveRequest[] }) {
  const router = useRouter();
  const { state } = useSession();

  const filtered = useMemo(() => initialRows, [initialRows]);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const pendingCount = filtered.filter((r) => r.status === 'PENDING').length;
  const approvedCount = filtered.filter((r) => r.status === 'APPROVED').length;

  return (
    <PageBody>
      <PageHeader
        title="Leave Requests"
        description="Employee leave applications and their approval status."
      />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-4">
        <Stat label="Requests" value={String(filtered.length)} />
        <Stat label="Pending" value={String(pendingCount)} />
        <Stat label="Approved" value={String(approvedCount)} />
        <Stat label="Days requested" value={String(filtered.reduce((sum, r) => sum + r.days, 0))} />
      </div>

      <HrisDataTable
        rows={filtered}
        columns={buildLeaveRequestsColumns()}
        filters={buildLeaveRequestsFilters(filtered)}
        searchable
        searchText={LEAVE_REQUESTS_SEARCH_TEXT}
        searchPlaceholder="Search by employee, number or leave type…"
        selectable={false}
        views={{
          builtIn: LEAVE_REQUESTS_BUILT_IN_VIEWS,
          storageKey: LEAVE_REQUESTS_VIEWS_STORAGE_KEY,
        }}
        status="ready"
        emptyTitle="No leave requests match this view yet."
        emptyDescription="Try a different status filter."
        noResultsTitle="No requests match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every request."
      />
    </PageBody>
  );
}
