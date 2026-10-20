'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  HrisDataTable,
  EMPTY_FILTERS,
  type DataTableColumn,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Progress } from '@/components/ui/progress';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { tenantsApi } from '@/features/tenants/tenants-api';

import type { TenantSummary } from '@hris/shared-types';

function bytesLabel(value: number | null): string {
  if (value === null) {
    return '∞';
  }
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(value / (1024 * 1024)).toFixed(0)} MB`;
}

function percent(used: number | null, limit: number | null): number {
  if (used === null || limit === null || limit === 0) {
    return 0;
  }
  return Math.min(100, Math.round((used / limit) * 100));
}

const QUOTAS_VIEWS_STORAGE_KEY = 'hris:usage-quotas:views';

const QUOTAS_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All tenants',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

function buildTenantColumns(): readonly DataTableColumn<TenantSummary>[] {
  return [
    {
      id: 'tenant',
      header: 'Tenant',
      sortValue: (row) => row.name,
      cellClassName: 'font-medium',
      cell: (row) => row.name,
    },
    {
      id: 'users',
      header: 'Users',
      sortValue: (row) => row.userCount,
      cellClassName: 'font-mono text-sm',
      cell: (row) => (
        <span>
          {row.userCount}
          {row.seatLimit !== null ? ` / ${row.seatLimit}` : ''}
        </span>
      ),
    },
    {
      id: 'storage',
      header: 'Storage',
      sortValue: (row) => row.storageUsedBytes,
      cellClassName: 'font-mono text-sm',
      cell: (row) => (
        <span>
          {bytesLabel(row.storageUsedBytes)}
          {row.storageQuotaBytes !== null ? ` / ${bytesLabel(row.storageQuotaBytes)}` : ''}
        </span>
      ),
    },
    {
      id: 'utilization',
      header: 'Utilization',
      sortValue: (row) =>
        Math.max(
          percent(row.userCount, row.seatLimit),
          percent(row.storageUsedBytes, row.storageQuotaBytes),
        ),
      align: 'right',
      cell: (row) => {
        const userPct = percent(row.userCount, row.seatLimit);
        const storagePct = percent(row.storageUsedBytes, row.storageQuotaBytes);
        const maxPct = Math.max(userPct, storagePct);
        return (
          <div className="flex items-center gap-2">
            <Progress value={maxPct} />
            <span className="font-mono text-xs">{maxPct}%</span>
          </div>
        );
      },
    },
  ];
}

export function UsageQuotasScreen() {
  const router = useRouter();
  const { state } = useSession();
  const tenants = useIamLoad(() => tenantsApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = (tenants.data ?? []) as TenantSummary[];

  return (
    <PageBody>
      <PageHeader
        title="Usage & Quotas"
        description="Per-tenant consumption against seat and storage quotas."
      />

      <HrisDataTable
        rows={rows}
        columns={buildTenantColumns()}
        searchable
        searchText={(row) => row.name}
        searchPlaceholder="Search by tenant name…"
        selectable={false}
        views={{ builtIn: QUOTAS_BUILT_IN_VIEWS, storageKey: QUOTAS_VIEWS_STORAGE_KEY }}
        status={
          tenants.loading && rows.length === 0
            ? 'loading'
            : tenants.error !== undefined
              ? 'error'
              : 'ready'
        }
        errorCopy={tenants.error}
        onRetry={() => tenants.reload()}
        emptyTitle="No tenants"
        emptyDescription="Tenants appear here once they are provisioned."
        noResultsTitle="No tenants match this filter"
        noResultsDescription="Try a different search to find the tenant you're looking for."
      />

      <p className="mt-3 text-sm text-muted-foreground">
        Utilization shows the higher of user-seat and storage usage against the tenant's quota.{' '}
        {canManage ? 'Quota limits are managed on the Tenants screen.' : ''}
      </p>
    </PageBody>
  );
}
