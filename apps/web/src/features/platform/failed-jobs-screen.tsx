'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Trash2 } from 'lucide-react';

import type { QueueJobSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

import { useCan, useSession } from '@/features/auth/session-context';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

interface FailedJobRow extends QueueJobSummary {
  readonly queue: string;
}

/**
 * Dead-letter view across every background queue: the Queue Monitor inspects one queue
 * at a time, while recovery work starts from "what is failed anywhere".
 */
export function FailedJobsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canManage = useCan('queue.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [rows, setRows] = useState<readonly FailedJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const queues = await platformApi.listQueues();
      const perQueue = await Promise.all(
        queues.map(async (queue) => {
          const failed = await platformApi.listQueueJobs(queue.name, 'failed');
          return failed.map((job) => ({ ...job, queue: queue.name }));
        }),
      );
      setRows(perQueue.flat());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (row: FailedJobRow) => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await platformApi.retryQueueJob(row.queue, row.id);
      setNotice(`Job ${row.id} requeued.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: FailedJobRow) => {
    if (!window.confirm(`Remove job ${row.id} from ${row.queue}? This cannot be undone.`)) {
      return;
    }
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await platformApi.removeQueueJob(row.queue, row.id);
      setNotice(`Job ${row.id} removed.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="Failed Jobs"
        description="Dead-lettered jobs across all queues, with retry and removal."
        actions={
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No failed jobs — every queue is clear" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Failed jobs</CardTitle>
            <CardDescription>
              {rows.length} job{rows.length === 1 ? '' : 's'} awaiting recovery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.queue}:${row.id}`}>
                    <TableCell>
                      <Badge variant="outline">{row.queue}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.id}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-sm">{row.attemptsMade}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground text-sm">
                      {row.failedReason ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void retry(row)}
                          >
                            <RotateCcw className="mr-1 size-4" aria-hidden />
                            Retry
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => void remove(row)}
                          >
                            <Trash2 className="mr-1 size-4" aria-hidden />
                            Remove
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
