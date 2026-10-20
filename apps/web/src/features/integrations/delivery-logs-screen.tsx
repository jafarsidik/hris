'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  INTEGRATION_DELIVERY_DIRECTIONS,
  INTEGRATION_DELIVERY_STATUSES,
  type DeliveryLogEntry,
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

const DELIVERY_LOGS_VIEWS_STORAGE_KEY = 'hris:integrations:delivery-logs:views';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

function statusVariant(status: DeliveryLogEntry['status']): 'success' | 'destructive' | 'warning' {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'FAILED') return 'destructive';
  return 'warning';
}

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(
    new Date(value),
  );
}

/** The free text a row matches against; every column a reader would search by. */
const DELIVERY_LOG_SEARCH_TEXT = (entry: DeliveryLogEntry): string =>
  [
    entry.integrationName,
    entry.integrationKey,
    entry.integrationKind,
    entry.operation,
    entry.direction,
    entry.status,
    entry.error ?? '',
  ].join(' ');

/**
 * The filters the toolbar shows.
 *
 * The API takes no query parameters — `deliveryLog(150)` returns the newest 150
 * attempts and nothing else — so filtering happens over the rows in hand, exactly as
 * the users table filters the list it was given. The status and direction vocabularies
 * are always offered, unioned with whatever the rows carry.
 */
function buildDeliveryLogFilters(
  rows: readonly DeliveryLogEntry[],
): readonly DataTableFilter<DeliveryLogEntry>[] {
  const presentStatuses = new Set<string>([
    ...INTEGRATION_DELIVERY_STATUSES,
    ...rows.map((row) => row.status),
  ]);
  const statusOptions = [...presentStatuses].map((status) => ({ value: status, label: status }));

  const presentDirections = new Set<string>([
    ...INTEGRATION_DELIVERY_DIRECTIONS,
    ...rows.map((row) => row.direction),
  ]);
  const directionOptions = [...presentDirections].map((direction) => ({
    value: direction,
    label: direction,
  }));

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
      id: 'direction',
      label: 'Direction',
      placeholder: 'All directions',
      advanced: true,
      getValue: (row) => row.direction,
      options: directionOptions,
    },
  ];
}

const withStatus = (status: DeliveryLogEntry['status']) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the delivery log ships with; the first is the default. */
const DELIVERY_LOG_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All deliveries',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'succeeded', name: 'Succeeded', builtIn: true, state: withStatus('SUCCEEDED') },
  { id: 'failed', name: 'Failed', builtIn: true, state: withStatus('FAILED') },
  { id: 'retrying', name: 'Retrying', builtIn: true, state: withStatus('RETRYING') },
];

/** The columns, in the order the screen has always shown them. */
const DELIVERY_LOG_COLUMNS: readonly DataTableColumn<DeliveryLogEntry>[] = [
  {
    id: 'when',
    header: 'When',
    sortValue: (row) => row.createdAt,
    cellClassName: 'font-mono text-sm',
    cell: (row) => formatWhen(row.createdAt),
  },
  {
    id: 'connection',
    header: 'Connection',
    sortValue: (row) => row.integrationName,
    cell: (row) => (
      <div>
        <div className="font-medium text-sm">{row.integrationName}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {row.integrationKind} · {row.integrationKey}
        </div>
      </div>
    ),
  },
  {
    id: 'operation',
    header: 'Operation',
    sortValue: (row) => row.operation,
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.operation,
  },
  {
    id: 'direction',
    header: 'Direction',
    sortValue: (row) => row.direction,
    cellClassName: 'text-muted-foreground text-sm',
    cell: (row) => row.direction,
  },
  {
    id: 'status',
    header: 'Status',
    sortValue: (row) => row.status,
    cell: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
  },
  {
    id: 'attempt',
    header: 'Attempt',
    align: 'right',
    sortValue: (row) => row.attempt,
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.attempt,
  },
  {
    id: 'duration',
    header: 'Duration',
    align: 'right',
    // `null` means the attempt never completed; it sorts before every measured duration.
    sortValue: (row) => row.durationMs ?? -1,
    cellClassName: 'font-mono text-sm',
    cell: (row) => (row.durationMs === null ? '—' : `${row.durationMs} ms`),
  },
  {
    id: 'error',
    header: 'Error',
    sortValue: (row) => row.error ?? '',
    cellClassName: 'max-w-56 truncate text-muted-foreground text-sm',
    cell: (row) => row.error ?? '—',
  },
];

/** One feed of every outbound delivery attempt, newest first, across all connections. */
export function DeliveryLogsScreen() {
  const router = useRouter();
  const { state } = useSession();

  const [rows, setRows] = useState<readonly DeliveryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await integrationOpsApi.deliveryLog(150));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageBody>
      <PageHeader
        title="Delivery Logs"
        description="Per-message delivery outcomes across every connection, newest first."
      />

      <HrisDataTable
        rows={rows}
        columns={DELIVERY_LOG_COLUMNS}
        filters={buildDeliveryLogFilters(rows)}
        searchable
        searchText={DELIVERY_LOG_SEARCH_TEXT}
        searchPlaceholder="Search by connection, operation or error…"
        selectable={false}
        views={{
          builtIn: DELIVERY_LOG_BUILT_IN_VIEWS,
          storageKey: DELIVERY_LOGS_VIEWS_STORAGE_KEY,
        }}
        actions={
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className="mr-1 size-4" aria-hidden />
            Refresh
          </Button>
        }
        status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
        errorCopy={error}
        onRetry={load}
        emptyTitle="No deliveries recorded yet"
        emptyDescription="Deliveries are recorded as the platform sends through connections; nothing has been written yet."
        noResultsTitle="No deliveries match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every recorded delivery."
      />
    </PageBody>
  );
}
