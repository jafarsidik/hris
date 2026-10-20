'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';

import { useSession } from '@/features/auth/session-context';

import {
  LEAVE_POLICIES_BUILT_IN_VIEWS,
  LEAVE_POLICIES_SEARCH_TEXT,
  LEAVE_POLICIES_VIEWS_STORAGE_KEY,
  buildLeavePoliciesColumns,
} from './leave-policies-table-config';
import type { LeavePolicy } from './leave-types';

/**
 * Leave Policies: how many days of each leave type an employee earns per
 * year and whether unused days carry forward.
 */
export function LeavePoliciesScreen({ rows }: { rows: readonly LeavePolicy[] }) {
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
        title="Leave Policies"
        description="Entitlement per leave type — annual days and carry-forward rules."
      />

      <HrisDataTable
        rows={rows}
        columns={buildLeavePoliciesColumns()}
        searchable
        searchText={LEAVE_POLICIES_SEARCH_TEXT}
        searchPlaceholder="Search by leave type…"
        selectable={false}
        views={{
          builtIn: LEAVE_POLICIES_BUILT_IN_VIEWS,
          storageKey: LEAVE_POLICIES_VIEWS_STORAGE_KEY,
        }}
        status="ready"
        emptyTitle="No leave policies defined yet"
        emptyDescription="Leave policies created here appear in this list."
        noResultsTitle="No policies match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every policy."
      />
    </PageBody>
  );
}
