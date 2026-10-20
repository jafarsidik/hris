'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { getIam } from '@/features/iam';
import {
  ACCESS_POLICY_BUILT_IN_VIEWS,
  ACCESS_POLICY_SEARCH_TEXT,
  ACCESS_POLICY_VIEWS_STORAGE_KEY,
  buildAccessPolicyColumns,
  type AccessPolicyRow,
} from '@/features/governance/access-policies-table-config';

interface PermissionRow {
  readonly resource: string;
  readonly action: string;
}

export function AccessPoliciesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canManage = useCan('registry.manage');
  const policies = useIamLoad(() => getIam().listPermissions(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = useMemo<AccessPolicyRow[]>(() => {
    const byResource = new Map<string, string[]>();
    for (const row of (policies.data ?? []) as readonly PermissionRow[]) {
      const actions = byResource.get(row.resource) ?? [];
      if (!actions.includes(row.action)) {
        actions.push(row.action);
      }
      byResource.set(row.resource, actions);
    }
    return Array.from(byResource.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([resource, actions]) => ({ id: resource, resource, actions }));
  }, [policies.data]);

  return (
    <PageBody>
      <PageHeader
        title="Access Policies"
        description="Capability catalogue: each resource and the actions that can be granted on it."
      />

      <HrisDataTable
        rows={rows}
        columns={buildAccessPolicyColumns({ canManage })}
        searchable
        searchText={ACCESS_POLICY_SEARCH_TEXT}
        searchPlaceholder="Search by resource or action…"
        selectable={false}
        views={{
          builtIn: ACCESS_POLICY_BUILT_IN_VIEWS,
          storageKey: ACCESS_POLICY_VIEWS_STORAGE_KEY,
        }}
        status={policies.loading ? 'loading' : policies.error !== undefined ? 'error' : 'ready'}
        errorCopy={policies.error}
        onRetry={() => policies.reload()}
        emptyTitle="No capabilities defined"
        emptyDescription="Capabilities registered on the platform appear here."
        noResultsTitle="No capabilities match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every resource."
      />
    </PageBody>
  );
}
