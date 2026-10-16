'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { QueueJobState, QueueSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

const STATES: readonly QueueJobState[] = ['failed', 'active', 'waiting', 'completed', 'delayed'];

/**
 * Queue monitor (System -> Operations).
 *
 * Read access is `queue:view`; retrying a failed job is `queue:manage`, which the API
 * enforces — the button is shown optimistically and any refusal surfaces as an error.
 */
export function QueueMonitorScreen() {
  const router = useRouter();
  const { state } = useSession();
  const queues = useIamLoad(() => platformApi.listQueues(), []);

  const [selected, setSelected] = useState<string | null>(null);
  const [jobState, setJobState] = useState<QueueJobState>('failed');
  const [error, setError] = useState<string | undefined>();

  const jobs = useIamLoad(
    () => (selected === null ? Promise.resolve([]) : platformApi.listQueueJobs(selected, jobState)),
    [selected, jobState],
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    if (selected === null && (queues.data ?? []).length > 0) {
      setSelected(queues.data?.[0]?.name ?? null);
    }
  }, [queues.data, selected]);

  const retry = useCallback(
    async (jobId: string) => {
      if (selected === null) {
        return;
      }
      setError(undefined);
      try {
        await platformApi.retryQueueJob(selected, jobId);
        jobs.reload();
        queues.reload();
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError ? cause.message : 'The job could not be retried.',
        );
      }
    },
    [selected, jobs, queues],
  );

  return (
    <PageBody>
      <PageHeader title="Background jobs" description="Queue health and failed job recovery." />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Queues</CardTitle>
          <CardDescription>Counts by state for each background queue.</CardDescription>
        </CardHeader>
        <CardContent>
          {queues.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (queues.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No queues are registered.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(queues.data ?? []).map((queue: QueueSummary) => (
                <li key={queue.name} className="flex items-center justify-between gap-3 py-3">
                  <button
                    type="button"
                    className="min-w-0 truncate font-mono text-sm hover:underline"
                    onClick={() => setSelected(queue.name)}
                  >
                    {queue.name}
                  </button>
                  <div className="flex items-center gap-1">
                    {queue.isPaused && <Badge variant="outline">Paused</Badge>}
                    <Badge variant="secondary">active {queue.counts.active}</Badge>
                    <Badge variant="secondary">waiting {queue.counts.waiting}</Badge>
                    <Badge variant={queue.counts.failed > 0 ? 'destructive' : 'secondary'}>
                      failed {queue.counts.failed}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Jobs{selected !== null ? ` · ${selected}` : ''}</CardTitle>
            <CardDescription>Inspect and retry recent jobs.</CardDescription>
          </div>
          <select
            aria-label="Job state"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={jobState}
            onChange={(event) => setJobState(event.currentTarget.value as QueueJobState)}
          >
            {STATES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {selected === null || jobs.loading ? (
            <Skeleton className="h-12 w-full" />
          ) : (jobs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs in this state.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(jobs.data ?? []).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs">{job.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {job.failedReason ?? `attempts: ${job.attemptsMade}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{job.state}</Badge>
                    <Button variant="outline" onClick={() => void retry(job.id)}>
                      Retry
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
