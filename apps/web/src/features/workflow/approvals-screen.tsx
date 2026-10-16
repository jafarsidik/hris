'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { WorkflowTaskSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { workflowApi } from '@/features/workflow/workflow-api';
import { ApiRequestError } from '@/lib/api/http-client';

type BadgeTone =
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';

const STATUS_TONE: Readonly<Record<WorkflowTaskSummary['status'], BadgeTone>> = {
  PENDING: 'warning',
  CLAIMED: 'info',
  APPROVED: 'success',
  REJECTED: 'destructive',
  SKIPPED: 'secondary',
  ESCALATED: 'warning',
  EXPIRED: 'outline',
};

/** A task the caller may still act on. Everything else is history. */
const isOpen = (task: WorkflowTaskSummary): boolean =>
  task.status === 'PENDING' || task.status === 'CLAIMED';

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * The signed-in approver's inbox.
 *
 * Only tasks assigned to the caller are listed (`/workflow-tasks/mine`), and the engine
 * re-checks the step's permission plus the approval-authority rules on every decision —
 * the buttons here are an affordance, not the guard. Open tasks are separated from the
 * caller's own decision history so "what still needs me" is never buried in it.
 */
export function ApprovalsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const tasks = useIamLoad(() => workflowApi.myTasks(), []);

  const [showAll, setShowAll] = useState(false);
  const [comments, setComments] = useState<Readonly<Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const setComment = useCallback((taskId: string, value: string) => {
    setComments((current) => ({ ...current, [taskId]: value }));
  }, []);

  const run = useCallback(
    async (taskId: string, action: () => Promise<unknown>) => {
      setError(undefined);
      setBusy(taskId);
      try {
        await action();
        tasks.reload();
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError ? cause.message : 'The task could not be updated.',
        );
      } finally {
        setBusy(null);
      }
    },
    [tasks],
  );

  const rows = tasks.data ?? [];
  const visible = showAll ? rows : rows.filter(isOpen);
  const openCount = rows.filter(isOpen).length;

  return (
    <PageBody>
      <PageHeader
        title="My approvals"
        description="Tasks assigned to you by an approval workflow."
        actions={
          <Button variant="outline" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show only open' : 'Show all'}
          </Button>
        }
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tasks.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{tasks.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            {tasks.loading
              ? 'Loading…'
              : `${openCount} open task${openCount === 1 ? '' : 's'}${
                  showAll ? ` of ${rows.length} total` : ''
                }.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.loading ? (
            <Skeleton className="h-24 w-full" />
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? 'You have no workflow tasks.'
                : 'Nothing open. Switch to “Show all” to review your decisions.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  comment={comments[task.id] ?? ''}
                  busy={busy === task.id}
                  onComment={(value) => setComment(task.id, value)}
                  onClaim={() => {
                    void run(task.id, () => workflowApi.claimTask(task.id));
                  }}
                  onDecide={(decision) => {
                    void run(task.id, () =>
                      workflowApi.decideTask(
                        task.id,
                        decision,
                        comments[task.id]?.trim() ?? undefined,
                      ),
                    );
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}

function TaskRow({
  task,
  comment,
  busy,
  onComment,
  onClaim,
  onDecide,
}: {
  readonly task: WorkflowTaskSummary;
  readonly comment: string;
  readonly busy: boolean;
  readonly onComment: (value: string) => void;
  readonly onClaim: () => void;
  readonly onDecide: (decision: 'APPROVE' | 'REJECT' | 'SKIP') => void;
}) {
  const open = isOpen(task);

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_TONE[task.status]}>{task.status}</Badge>
        <span className="font-medium">{task.stepKey}</span>
        {task.requiredPermission !== null && (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {task.requiredPermission}
          </code>
        )}
        <span className="text-xs text-muted-foreground">
          Created {formatTimestamp(task.createdAt)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
        <Detail label="State" value={task.stateKey ?? '—'} />
        <Detail label="Due" value={task.dueAt === null ? '—' : formatTimestamp(task.dueAt)} />
        <Detail
          label="Escalation"
          value={task.escalationAt === null ? '—' : formatTimestamp(task.escalationAt)}
        />
        <Detail
          label={open ? 'Assignee' : 'Decided'}
          value={
            open
              ? (task.assigneeUserId ?? 'Unassigned')
              : task.decidedAt === null
                ? '—'
                : formatTimestamp(task.decidedAt)
          }
        />
      </dl>

      {task.decisionComment !== null && (
        <p className="text-sm text-muted-foreground">Comment: {task.decisionComment}</p>
      )}

      {open && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`comment-${task.id}`}>Comment (optional)</Label>
            <Textarea
              id={`comment-${task.id}`}
              rows={2}
              value={comment}
              disabled={busy}
              placeholder="Add context for the audit trail…"
              onChange={(event) => onComment(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {task.status === 'PENDING' && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={onClaim}>
                Claim
              </Button>
            )}
            <Button size="sm" disabled={busy} onClick={() => onDecide('APPROVE')}>
              Approve
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide('REJECT')}>
              Reject
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDecide('SKIP')}>
              Skip
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
