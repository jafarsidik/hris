'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';

import type { ApiUsageRow } from './developer-types';
import { getDevelopers } from './index';
import { ServerPagedTable } from './server-paged-table';
import type { DataTableColumn } from '@/components/data-table';

/**
 * A report row with the key the table needs.
 *
 * The report is keyed by client — the screen used `clientId` as the row key before the
 * shared table required `id` — so the two are the same value, carried as `id` here.
 */
type UsageRow = ApiUsageRow & { readonly id: string };

/** The selectable reporting windows, newest bound first. */
const WINDOWS = [
  { key: 'all', label: 'All time' },
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
] as const;

type WindowKey = (typeof WINDOWS)[number]['key'];

const HOURS: Readonly<Record<Exclude<WindowKey, 'all'>, number>> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

/** The inclusive lower bound for a window, or `undefined` for "all time". */
function windowFrom(key: WindowKey): string | undefined {
  if (key === 'all') {
    return undefined;
  }
  return new Date(Date.now() - HOURS[key] * 3_600_000).toISOString();
}

function formatDuration(value: number | null): string {
  return value === null ? '—' : `${value} ms`;
}

function errorRate(row: ApiUsageRow): string {
  if (row.requestCount === 0) {
    return '—';
  }
  return `${Math.round((row.errorCount / row.requestCount) * 100)}%`;
}

/**
 * Developer API usage by client.
 *
 * Requests are recorded per client by the API; this screen asks for a rollup over a
 * chosen window. The window is applied server-side, so the whole tenant's volume is
 * counted rather than a page of it.
 */
export function UsageScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getDevelopers();

  const [windowKey, setWindowKey] = useState<WindowKey>('all');
  const [clientId, setClientId] = useState('ALL');

  const clients = useIamLoad(() => repository.listClients(), []);
  const report = useIamLoad(() => {
    const from = windowFrom(windowKey);
    return repository.getUsage({
      ...(from === undefined ? {} : { from }),
      ...(clientId === 'ALL' ? {} : { clientId }),
    });
  }, [windowKey, clientId]);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  /*
   * No `sortValue` on any column, for the same reason the request log has none: the
   * window and the client filter are server queries over the whole tenant, so a
   * client-side sort would reorder the rollup rows in hand and present that as the
   * order of the report.
   */
  const columns: readonly DataTableColumn<UsageRow>[] = [
    {
      id: 'client',
      header: 'Client',
      cellClassName: 'font-medium',
      cell: (row) => row.name,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'outline'}>
          {row.isActive ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      id: 'requests',
      header: 'Requests',
      align: 'right',
      cellClassName: 'text-right tabular-nums',
      cell: (row) => row.requestCount,
    },
    {
      id: 'errors',
      header: 'Errors',
      align: 'right',
      cellClassName: 'text-right tabular-nums',
      cell: (row) => row.errorCount,
    },
    {
      id: 'errorRate',
      header: 'Error rate',
      align: 'right',
      cellClassName: 'text-right tabular-nums',
      cell: (row) => errorRate(row),
    },
    {
      id: 'avgLatency',
      header: 'Avg latency',
      align: 'right',
      cellClassName: 'text-right tabular-nums',
      cell: (row) => formatDuration(row.avgDurationMs),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="API Usage"
        description="Request volume, error rate and latency for machine clients."
      />

      <ServerPagedTable
        rows={(report.data?.items ?? []).map((row) => ({ ...row, id: row.clientId }))}
        columns={columns}
        actions={
          <>
            <Select
              value={windowKey}
              onValueChange={(value) => {
                if (value !== null) {
                  setWindowKey(value as WindowKey);
                }
              }}
            >
              <SelectTrigger aria-label="Reporting window" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={clientId}
              onValueChange={(value) => {
                if (value !== null) {
                  setClientId(value);
                }
              }}
            >
              <SelectTrigger aria-label="Filter by client" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All clients</SelectItem>
                {(clients.data ?? []).map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {report.data === null
                ? ''
                : `${report.data.totalRequests} requests · ${report.data.totalErrors} errors`}
            </span>
          </>
        }
        loading={report.loading}
        error={report.error}
        onRetry={() => report.reload()}
        emptyTitle="No API clients to report on."
        emptyDescription="Once an API client exists it appears here with its request volume for the window."
      />
    </PageBody>
  );
}
