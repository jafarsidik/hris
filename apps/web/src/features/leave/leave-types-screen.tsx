'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';

import { useSession } from '@/features/auth/session-context';

import {
  LEAVE_TYPES_BUILT_IN_VIEWS,
  LEAVE_TYPES_SEARCH_TEXT,
  LEAVE_TYPES_VIEWS_STORAGE_KEY,
  buildLeaveTypesColumns,
} from './leave-types-table-config';
import type { LeaveType } from './leave-types';

/**
 * Leave Types: the definitions that requests refer to — paid status and the
 * default number of days each type grants.
 */
export function LeaveTypesScreen({ rows }: { rows: readonly LeaveType[] }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader
        title="Leave Types"
        description="Leave type definitions — paid status and default entitlement."
      />

      <HrisDataTable
        rows={rows}
        columns={buildLeaveTypesColumns()}
        searchable
        searchText={LEAVE_TYPES_SEARCH_TEXT}
        searchPlaceholder="Search by code, name or description…"
        selectable={false}
        views={{
          builtIn: LEAVE_TYPES_BUILT_IN_VIEWS,
          storageKey: LEAVE_TYPES_VIEWS_STORAGE_KEY,
        }}
        status="ready"
        emptyTitle="No leave types defined yet"
        emptyDescription="Leave types created here appear in this list."
        noResultsTitle="No types match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every type."
      />
    </PageBody>
  );
}
