'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';

import type { ApiUsageRow } from './developer-types';
import { getDevelopers } from './index';

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

  return (
    <PageBody>
      <PageHeader
        title="API Usage"
        description="Request volume, error rate and latency for machine clients."
      />

      <PageToolbar>
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
        <span className="ml-auto text-sm text-muted-foreground">
          {report.data === null
            ? ''
            : `${report.data.totalRequests} requests · ${report.data.totalErrors} errors`}
        </span>
      </PageToolbar>

      {report.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : report.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {report.error}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Errors</TableHead>
              <TableHead className="text-right">Error rate</TableHead>
              <TableHead className="text-right">Avg latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(report.data?.items ?? []).map((row) => (
              <TableRow key={row.clientId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Badge variant={row.isActive ? 'success' : 'outline'}>
                    {row.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.requestCount}</TableCell>
                <TableCell className="text-right tabular-nums">{row.errorCount}</TableCell>
                <TableCell className="text-right tabular-nums">{errorRate(row)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDuration(row.avgDurationMs)}
                </TableCell>
              </TableRow>
            ))}
            {(report.data?.items.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No API clients to report on.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </PageBody>
  );
}
