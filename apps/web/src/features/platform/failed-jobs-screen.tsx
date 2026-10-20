'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { RotateCcw, Trash2 } from 'lucide-react';

import { useCan, useSession } from '@/features/auth/session-context';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { QueueJobSummary } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

interface FailedJobRow extends Omit<QueueJobSummary, 'id'> {
  /** The composite primary key: job ids are unique per queue, not across queues. */
  readonly id: string;
  readonly queue: string;
  /** The queue's own job id, kept for display and for the retry/remove calls. */
  readonly jobId: string;
}

/**
 * Dead-letter view across every background queue: the Queue Monitor inspects one queue
 * at a time, while recovery work starts from "what is failed anywhere".
 *
 * The list used to be a bare `<table>` inside a `Card` with a skeleton while loading
 * and a one-line empty state, and its remove action was a `window.confirm`. It now
 * renders through the shared table, and remove goes through the confirm dialog: the
 * job and its queue are named, the consequence is stated, the failure stays inside
 * the dialog, and a success raises a toast. Filtering is client-side and honest —
 * the screen already holds every failed job from every queue in memory.
 */
export function FailedJobsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canManage = useCan('queue.manage');
  const { toast } = useToast();

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

  const [confirming, setConfirming] = useState<FailedJobRow | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const queues = await platformApi.listQueues();
      const perQueue = await Promise.all(
        queues.map(async (queue) => {
          const failed = await platformApi.listQueueJobs(queue.name, 'failed');
          return failed.map((job) => ({
            ...job,
            jobId: job.id,
            id: `${queue.name}:${job.id}`,
            queue: queue.name,
          }));
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
      await platformApi.retryQueueJob(row.queue, row.jobId);
      setNotice(`Job ${row.jobId} requeued.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = useCallback((row: FailedJobRow) => {
    setConfirming(row);
    setConfirmError(undefined);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (confirming === null) {
      return;
    }
    setConfirmPending(true);
    setConfirmError(undefined);
    try {
      await platformApi.removeQueueJob(confirming.queue, confirming.jobId);
      toast({
        title: 'Job removed',
        description: `Job ${confirming.jobId} removed.`,
        variant: 'success',
      });
      setConfirming(null);
      await load();
    } catch (cause) {
      setConfirmError(messageOf(cause));
    } finally {
      setConfirmPending(false);
    }
  }, [confirming, load, toast]);

  const queueOptions = [...new Set(rows.map((row) => row.queue))]
    .sort((left, right) => left.localeCompare(right))
    .map((queue) => ({ value: queue, label: queue }));

  const queueFilters: readonly DataTableFilter<FailedJobRow>[] = [
    {
      kind: 'select',
      id: 'queue',
      label: 'Queue',
      placeholder: 'All queues',
      getValue: (row) => row.queue,
      options: queueOptions,
    },
  ];

  const columns: readonly DataTableColumn<FailedJobRow>[] = [
    {
      id: 'queue',
      header: 'Queue',
      sortValue: (row) => row.queue,
      cell: (row) => <Badge variant="outline">{row.queue}</Badge>,
    },
    {
      id: 'job',
      header: 'Job',
      sortValue: (row) => row.jobId,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.jobId,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (row) => row.name,
      cellClassName: 'font-medium',
      cell: (row) => row.name,
    },
    {
      id: 'attempts',
      header: 'Attempts',
      sortValue: (row) => row.attemptsMade,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.attemptsMade,
    },
    {
      id: 'reason',
      header: 'Reason',
      sortValue: (row) => row.failedReason ?? '',
      cellClassName: 'max-w-md truncate text-muted-foreground text-sm',
      cell: (row) => row.failedReason ?? '—',
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: <span className="sr-only">Actions</span>,
            hideable: false,
            headerClassName: PINNED_ACTIONS_HEADER_CLASS,
            cellClassName: PINNED_ACTIONS_CELL_CLASS,
            cell: (row: FailedJobRow) => (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void retry(row)}>
                  <RotateCcw className="mr-1 size-4" aria-hidden />
                  Retry
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(row)}>
                  <Trash2 className="mr-1 size-4" aria-hidden />
                  Remove
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

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

      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={queueFilters}
        searchable
        searchText={(row) => `${row.queue} ${row.jobId} ${row.name} ${row.failedReason ?? ''}`}
        searchPlaceholder="Search by queue, job, name or reason…"
        selectable={false}
        status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
        errorCopy={error}
        onRetry={() => void load()}
        emptyTitle="No failed jobs — every queue is clear"
        emptyDescription="Failed jobs appear here when a queue dead-letters them."
        noResultsTitle="No failed jobs match this filter"
        noResultsDescription="Try a different search or queue, or clear the filters to see every failed job."
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
            setConfirmError(undefined);
          }
        }}
        title={
          confirming !== null
            ? `Remove job ${confirming.jobId} from ${confirming.queue}?`
            : 'Remove job?'
        }
        description="The job is dropped from the dead letter. This cannot be undone."
        confirmLabel="Remove"
        tone="destructive"
        pending={confirmPending}
        error={confirmError}
        onConfirm={() => void confirmRemove()}
      />
    </PageBody>
  );
}
