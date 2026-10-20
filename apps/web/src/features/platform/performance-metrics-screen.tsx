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
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';

import type { QueuePerformanceSummary } from '@hris/shared-types';

function ms(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} s`;
  }
  return `${value} ms`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
        {hint !== undefined && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardHeader>
    </Card>
  );
}

function latencyCell(queue: QueuePerformanceSummary): string {
  const latency = queue.latency;
  if (latency === null) {
    return '—';
  }
  return `avg ${ms(latency.avgMs)} · p95 ${ms(latency.p95Ms)} · max ${ms(latency.maxMs)}`;
}

type QueueRow = QueuePerformanceSummary & { readonly id: string };

const QUEUE_VIEWS_STORAGE_KEY = 'hris:performance-metrics:views';

const QUEUE_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All queues',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

function buildQueueColumns(): readonly DataTableColumn<QueueRow>[] {
  return [
    {
      id: 'queue',
      header: 'Queue',
      sortValue: (row) => row.queue,
      cellClassName: 'font-medium',
      cell: (row) => (
        <span>
          {row.queue}
          {row.isPaused && (
            <Badge variant="secondary" className="ml-2">
              PAUSED
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: 'waiting',
      header: 'Waiting',
      sortValue: (row) => row.counts.waiting,
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.counts.waiting,
    },
    {
      id: 'active',
      header: 'Active',
      sortValue: (row) => row.counts.active,
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.counts.active,
    },
    {
      id: 'delayed',
      header: 'Delayed',
      sortValue: (row) => row.counts.delayed,
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.counts.delayed,
    },
    {
      id: 'failed',
      header: 'Failed',
      sortValue: (row) => row.counts.failed,
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.counts.failed,
    },
    {
      id: 'done1h',
      header: 'Done 1h',
      sortValue: (row) => row.completedLastHour,
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.completedLastHour,
    },
    {
      id: 'done24h',
      header: 'Done 24h',
      sortValue: (row) => row.completedLast24h,
      align: 'right',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.completedLast24h,
    },
    {
      id: 'latency',
      header: 'Latency',
      sortValue: (row) => row.latency?.avgMs ?? 0,
      cellClassName: 'font-mono text-sm',
      cell: (row) => latencyCell(row),
    },
  ];
}

export function PerformanceMetricsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const metrics = useIamLoad(() => platformApi.performanceMetrics(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  // `useIamLoad` hands back `null` until the load settles, so this must stay nullable: a
  // cast to `| undefined` would make the guard below read `null !== undefined` as true and
  // dereference `totals` on the loading render.
  const data = metrics.data;
  const queues = data?.queues ?? [];

  const rows: QueueRow[] = queues.map((queue) => ({ ...queue, id: queue.queue }));

  return (
    <PageBody>
      <PageHeader
        title="Performance Metrics"
        description="Latency, throughput and saturation across the background queues."
      />

      {data !== null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="In flight"
            value={String(data.totals.waiting + data.totals.active)}
            hint={`${data.totals.waiting} waiting · ${data.totals.active} active`}
          />
          <Stat label="Delayed" value={String(data.totals.delayed)} hint="scheduled for later" />
          <Stat
            label="Failed"
            value={String(data.totals.failed)}
            hint="retained dead-letter jobs"
          />
          <Stat
            label="Completed (1h)"
            value={String(data.totals.completedLastHour)}
            hint="throughput over the last hour"
          />
        </div>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildQueueColumns()}
        searchable
        searchText={(row) => row.queue}
        searchPlaceholder="Search by queue name…"
        selectable={false}
        views={{ builtIn: QUEUE_BUILT_IN_VIEWS, storageKey: QUEUE_VIEWS_STORAGE_KEY }}
        status={metrics.loading ? 'loading' : metrics.error !== undefined ? 'error' : 'ready'}
        errorCopy={metrics.error}
        onRetry={() => metrics.reload()}
        emptyTitle="No metrics available"
        emptyDescription="Metrics appear once the platform starts sampling queue performance."
        noResultsTitle="No queues match this filter"
        noResultsDescription="Try a different search to find the queue you're looking for."
      />

      {data !== null && (
        <p className="text-sm text-muted-foreground">
          Sampled {new Date(data.sampledAt).toLocaleString()} · latency over retained completed jobs
        </p>
      )}
    </PageBody>
  );
}
