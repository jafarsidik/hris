'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { PerformanceMetricsSummary, QueuePerformanceSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { platformApi } from '@/features/platform/platform-api';

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

export function PerformanceMetricsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const metrics = useIamLoad(() => platformApi.performanceMetrics(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const data = metrics.data as PerformanceMetricsSummary | undefined;
  const queues = data?.queues ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Performance Metrics"
        description="Latency, throughput and saturation across the background queues."
      />

      {metrics.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{metrics.error}</AlertDescription>
        </Alert>
      )}

      {metrics.loading ? (
        <Skeleton className="h-60 w-full" />
      ) : data === undefined ? (
        <EmptyState title="No metrics available" />
      ) : (
        <>
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

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Per queue</CardTitle>
              <CardDescription>
                Sampled {new Date(data.sampledAt).toLocaleString()} · latency over retained
                completed jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queues.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No queues configured — background jobs require Redis.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Queue</TableHead>
                      <TableHead className="text-right">Waiting</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                      <TableHead className="text-right">Delayed</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Done 1h</TableHead>
                      <TableHead className="text-right">Done 24h</TableHead>
                      <TableHead>Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queues.map((queue) => (
                      <TableRow key={queue.queue}>
                        <TableCell className="font-medium">
                          {queue.queue}
                          {queue.isPaused && (
                            <Badge variant="secondary" className="ml-2">
                              PAUSED
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {queue.counts.waiting}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {queue.counts.active}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {queue.counts.delayed}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {queue.counts.failed}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {queue.completedLastHour}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {queue.completedLast24h}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{latencyCell(queue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageBody>
  );
}
