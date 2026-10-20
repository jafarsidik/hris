'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  INTEGRATION_KINDS,
  INTEGRATION_STATUSES,
  type IntegrationHealthSummary,
} from '@hris/shared-types';

import {
  HrisDataTable,
  EMPTY_FILTERS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session-context';
import { integrationOpsApi } from '@/features/integrations/integration-ops-api';
import { ApiRequestError } from '@/lib/api/http-client';
import { RefreshCw } from 'lucide-react';

const MONITOR_VIEWS_STORAGE_KEY = 'hris:integrations:monitor:views';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

function statusVariant(
  status: IntegrationHealthSummary['status'],
): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (status === 'CONNECTED') return 'success';
  if (status === 'ERROR') return 'destructive';
  if (status === 'DISCONNECTED') return 'warning';
  return 'secondary';
}

/** The free text a row matches against; every column a reader would search by. */
const MONITOR_SEARCH_TEXT = (integration: IntegrationHealthSummary): string =>
  [
    integration.name,
    integration.key,
    integration.kind,
    integration.status,
    integration.lastMessage ?? '',
  ].join(' ');

/**
 * The filters the toolbar shows.
 *
 * The status and kind vocabularies are always offered, unioned with whatever the rows
 * carry. The enabled filter backs the "Disabled" view: a disabled integration is not a
 * status the API can be asked for, but it is a state an operator filters by.
 */
function buildMonitorFilters(
  rows: readonly IntegrationHealthSummary[],
): readonly DataTableFilter<IntegrationHealthSummary>[] {
  const presentStatuses = new Set<string>([
    ...INTEGRATION_STATUSES,
    ...rows.map((row) => row.status),
  ]);
  const statusOptions = [...presentStatuses].map((status) => ({ value: status, label: status }));

  const presentKinds = new Set<string>([...INTEGRATION_KINDS, ...rows.map((row) => row.kind)]);
  const kindOptions = [...presentKinds].map((kind) => ({ value: kind, label: kind }));

  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (row) => row.status,
      options: statusOptions,
    },
    {
      kind: 'select',
      id: 'kind',
      label: 'Kind',
      placeholder: 'All kinds',
      advanced: true,
      getValue: (row) => row.kind,
      options: kindOptions,
    },
    {
      kind: 'select',
      id: 'enabled',
      label: 'Enabled',
      placeholder: 'All states',
      advanced: true,
      getValue: (row) => (row.isEnabled ? 'true' : 'false'),
      options: [
        { value: 'true', label: 'Enabled' },
        { value: 'false', label: 'Disabled' },
      ],
    },
  ];
}

const withStatus = (status: IntegrationHealthSummary['status']) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the monitor ships with; the first is the default. */
const MONITOR_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All integrations',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'connected', name: 'Connected', builtIn: true, state: withStatus('CONNECTED') },
  { id: 'errors', name: 'Errors', builtIn: true, state: withStatus('ERROR') },
  {
    id: 'disabled',
    name: 'Disabled',
    builtIn: true,
    state: { filters: { ...EMPTY_FILTERS, select: { enabled: 'false' } }, search: '' },
  },
];

/** The columns, in the order the screen has always shown them. */
const MONITOR_COLUMNS: readonly DataTableColumn<IntegrationHealthSummary>[] = [
  {
    id: 'integration',
    header: 'Integration',
    sortValue: (row) => row.name,
    cell: (row) => (
      <div>
        <div className="font-medium">{row.name}</div>
        <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
      </div>
    ),
  },
  {
    id: 'kind',
    header: 'Kind',
    sortValue: (row) => row.kind,
    cell: (row) => <Badge variant="outline">{row.kind}</Badge>,
  },
  {
    id: 'status',
    header: 'Status',
    sortValue: (row) => row.status,
    cell: (row) => (
      <div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
          {!row.isEnabled && <Badge variant="secondary">DISABLED</Badge>}
        </div>
        {row.lastMessage !== null && (
          <div className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
            {row.lastMessage}
          </div>
        )}
      </div>
    ),
  },
  {
    id: 'lastCheck',
    header: 'Last check',
    sortValue: (row) => row.lastCheckedAt ?? '',
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.lastCheckedAt ?? '—',
  },
  {
    id: 'delivered24h',
    header: 'Delivered 24h',
    align: 'right',
    sortValue: (row) => row.succeededLast24h,
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.succeededLast24h,
  },
  {
    id: 'failed24h',
    header: 'Failed 24h',
    align: 'right',
    sortValue: (row) => row.failedLast24h,
    cellClassName: 'font-mono text-sm',
    cell: (row) => (
      <span className={row.failedLast24h > 0 ? 'text-destructive' : undefined}>
        {row.failedLast24h}
      </span>
    ),
  },
  {
    id: 'lastDelivery',
    header: 'Last delivery',
    align: 'right',
    sortValue: (row) => row.lastDeliveryAt ?? '',
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.lastDeliveryAt ?? '—',
  },
];

/**
 * External integration health at a glance: observed status, last check, and the last
 * 24 hours of delivery outcomes per connection. Configuration and testing live on the
 * Connections/detail screens; this one answers "is anything broken right now".
 */
export function IntegrationMonitorScreen() {
  const router = useRouter();
  const { state } = useSession();

  const [rows, setRows] = useState<readonly IntegrationHealthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [sampledAt, setSampledAt] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await integrationOpsApi.monitor());
      setSampledAt(new Date().toISOString());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unhealthy = rows.filter(
    (row) => row.status === 'ERROR' || row.status === 'DISCONNECTED' || row.failedLast24h > 0,
  ).length;

  return (
    <PageBody>
      <PageHeader
        title="Integration Monitor"
        description="External integration health and errors over the last 24 hours."
      />

      <HrisDataTable
        rows={rows}
        columns={MONITOR_COLUMNS}
        filters={buildMonitorFilters(rows)}
        searchable
        searchText={MONITOR_SEARCH_TEXT}
        searchPlaceholder="Search by name, key or status…"
        selectable={false}
        views={{ builtIn: MONITOR_BUILT_IN_VIEWS, storageKey: MONITOR_VIEWS_STORAGE_KEY }}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {rows.length} integration{rows.length === 1 ? '' : 's'}
              {unhealthy > 0 ? ` · ${unhealthy} need attention` : ' · all healthy'}
              {sampledAt !== null ? ` · sampled ${new Date(sampledAt).toLocaleTimeString()}` : ''}
            </span>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
              <RefreshCw className="mr-1 size-4" aria-hidden />
              Refresh
            </Button>
          </div>
        }
        status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
        errorCopy={error}
        onRetry={load}
        emptyTitle="No integrations configured"
        emptyDescription="Integrations appear here once they are registered and their health has been sampled."
        noResultsTitle="No integrations match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every integration."
      />
    </PageBody>
  );
}
