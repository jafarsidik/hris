'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontalIcon } from 'lucide-react';

import type { TenantSummary } from '@hris/shared-types';
import { TENANT_PLANS, TENANT_STATUSES } from '@hris/shared-types';

import {
  HrisDataTable,
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { tenantsApi } from '@/features/tenants/tenants-api';
import { ApiRequestError } from '@/lib/api/http-client';

const TENANT_VIEWS_STORAGE_KEY = 'hris:tenants:views';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request could not be completed.';
}

function bytesLabel(value: number | null): string {
  if (value === null) {
    return '∞';
  }
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(value / (1024 * 1024)).toFixed(0)} MB`;
}

const TENANT_SEARCH_TEXT = (tenant: TenantSummary): string => `${tenant.name} ${tenant.code}`;

const TENANT_STATUS_LABEL: Record<TenantSummary['status'], string> = {
  ACTIVE: 'Active',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
};

const TENANT_STATUS_VARIANT: Record<
  TenantSummary['status'],
  'success' | 'secondary' | 'warning' | 'destructive'
> = {
  ACTIVE: 'success',
  TRIAL: 'secondary',
  SUSPENDED: 'warning',
  ARCHIVED: 'destructive',
};

const TENANT_FILTERS: readonly DataTableFilter<TenantSummary>[] = [
  {
    kind: 'select',
    id: 'status',
    label: 'Status',
    placeholder: 'All statuses',
    getValue: (tenant) => tenant.status,
    options: TENANT_STATUSES.map((status) => ({
      value: status,
      label: TENANT_STATUS_LABEL[status],
    })),
  },
  {
    kind: 'select',
    id: 'plan',
    label: 'Plan',
    placeholder: 'All plans',
    getValue: (tenant) => tenant.plan,
    options: TENANT_PLANS.map((plan) => ({ value: plan, label: plan })),
  },
];

const TENANT_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All tenants',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  {
    id: 'active',
    name: 'Active',
    builtIn: true,
    state: { filters: { ...EMPTY_FILTERS, select: { status: 'ACTIVE' } }, search: '' },
  },
  {
    id: 'suspended',
    name: 'Suspended',
    builtIn: true,
    state: { filters: { ...EMPTY_FILTERS, select: { status: 'SUSPENDED' } }, search: '' },
  },
];

function buildTenantColumns({
  canManage,
  onToggleSuspend,
  onChangePlan,
}: {
  readonly canManage: boolean;
  readonly onToggleSuspend: (tenant: TenantSummary) => void;
  readonly onChangePlan: (tenant: TenantSummary, plan: string) => void;
}): readonly DataTableColumn<TenantSummary>[] {
  const columns: DataTableColumn<TenantSummary>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (tenant) => tenant.name,
      cellClassName: 'font-medium',
      cell: (tenant) => tenant.name,
    },
    {
      id: 'code',
      header: 'Code',
      sortValue: (tenant) => tenant.code,
      cellClassName: 'text-muted-foreground',
      cell: (tenant) => tenant.code,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (tenant) => tenant.status,
      cell: (tenant) => (
        <Badge variant={TENANT_STATUS_VARIANT[tenant.status]}>{tenant.status}</Badge>
      ),
    },
    {
      id: 'plan',
      header: 'Plan',
      sortValue: (tenant) => tenant.plan,
      cell: (tenant) => (
        <Select
          value={tenant.plan}
          onValueChange={(value) => {
            if (typeof value === 'string') {
              onChangePlan(tenant, value);
            }
          }}
          disabled={!canManage}
        >
          <SelectTrigger className="w-36" aria-label="Plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TENANT_PLANS.map((plan) => (
              <SelectItem key={plan} value={plan}>
                {plan}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'users',
      header: 'Users',
      sortValue: (tenant) => tenant.userCount,
      cellClassName: 'font-mono',
      cell: (tenant) => (
        <>
          {tenant.userCount}
          {tenant.seatLimit !== null ? ` / ${tenant.seatLimit}` : ''}
        </>
      ),
    },
    {
      id: 'storage',
      header: 'Storage',
      sortValue: (tenant) => tenant.storageUsedBytes,
      cellClassName: 'font-mono',
      cell: (tenant) => (
        <>
          {bytesLabel(tenant.storageUsedBytes)} / {bytesLabel(tenant.storageQuotaBytes)}
        </>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (tenant) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Actions for ${tenant.name}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <MoreHorizontalIcon aria-hidden="true" className="size-4" />
              </button>
            }
          >
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onToggleSuspend(tenant)}>
                {tenant.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuTrigger>
        </DropdownMenu>
      ),
    });
  }

  return columns;
}

export function TenantsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const tenants = useIamLoad(() => tenantsApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const toggleSuspend = useCallback(
    async (tenant: TenantSummary) => {
      setError(undefined);
      try {
        await (tenant.status === 'SUSPENDED'
          ? tenantsApi.activate(tenant.id)
          : tenantsApi.suspend(tenant.id));
        setNotice('Tenant status updated.');
        tenants.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [tenants],
  );

  const changePlan = useCallback(
    async (tenant: TenantSummary, plan: string) => {
      setError(undefined);
      try {
        await tenantsApi.update(tenant.id, { plan });
        setNotice('Plan updated.');
        tenants.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [tenants],
  );

  const rows = tenants.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Tenant Management"
        description="Companies on this platform, their plan, quota and lifecycle."
      />

      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildTenantColumns({
          canManage,
          onToggleSuspend: toggleSuspend,
          onChangePlan: changePlan,
        })}
        filters={TENANT_FILTERS}
        searchable
        searchText={TENANT_SEARCH_TEXT}
        searchPlaceholder="Search by name or code…"
        selectable={false}
        views={{ builtIn: TENANT_BUILT_IN_VIEWS, storageKey: TENANT_VIEWS_STORAGE_KEY }}
        status={tenants.loading ? 'loading' : tenants.error !== undefined ? 'error' : 'ready'}
        errorCopy={tenants.error}
        onRetry={() => tenants.reload()}
        emptyTitle="No tenants"
        emptyDescription="Tenants created here appear in this list."
        noResultsTitle="No tenants match this filter"
        noResultsDescription="Try a different search, status or plan, or clear the filters to see every tenant."
      />
    </PageBody>
  );
}
