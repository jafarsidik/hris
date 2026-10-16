'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { WORKFLOW_INSTANCE_STATUSES, type WorkflowInstanceStatus } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { workflowApi } from '@/features/workflow/workflow-api';

type Tone = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';

const STATUS_TONE: Readonly<Record<WorkflowInstanceStatus, Tone>> = {
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

const TASK_TONE: Readonly<Record<string, Tone>> = {
  PENDING: 'warning',
  CLAIMED: 'info',
  APPROVED: 'success',
  REJECTED: 'destructive',
  SKIPPED: 'secondary',
  ESCALATED: 'warning',
  EXPIRED: 'outline',
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * Workflow execution history (System -> Workflow & Automation).
 *
 * An instance is the running record of a definition version; its tasks are who had to
 * act and its history is what they did. Both are shown together because either alone
 * misleads: a task list without the transition trail cannot explain how a step was
 * satisfied, and the trail without the tasks hides who was asked.
 */
export function WorkflowInstancesScreen() {
  const router = useRouter();
  const { state } = useSession();

  const [status, setStatus] = useState<WorkflowInstanceStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const instances = useIamLoad(
    () => workflowApi.listInstances(status === 'ALL' ? {} : { status }),
    [status],
  );

  const detail = useIamLoad(
    () => (selectedId === null ? Promise.resolve(null) : workflowApi.getInstance(selectedId)),
    [selectedId],
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = instances.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Execution history"
        description="Workflow instances, the tasks they raised and the transitions they recorded."
      />

      {instances.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{instances.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', ...WORKFLOW_INSTANCE_STATUSES] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={status === option ? 'default' : 'outline'}
            onClick={() => setStatus(option)}
          >
            {option === 'ALL' ? 'All' : option.replace('_', ' ').toLowerCase()}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instances</CardTitle>
          <CardDescription>{rows.length} shown.</CardDescription>
        </CardHeader>
        <CardContent>
          {instances.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No instances match this filter.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map((instance) => (
                <li key={instance.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <code>{instance.id.slice(0, 8)}</code> · {instance.currentStateKey}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {instance.resource ?? 'no resource'}
                      {instance.resourceId === null ? '' : `/${instance.resourceId}`} · v
                      {instance.version} · {formatTimestamp(instance.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={STATUS_TONE[instance.status]}>
                      {instance.status.replace('_', ' ')}
                    </Badge>
                    <Button
                      variant={selectedId === instance.id ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setSelectedId((current) => (current === instance.id ? null : instance.id))
                      }
                    >
                      {selectedId === instance.id ? 'Close' : 'Inspect'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Instance {selectedId.slice(0, 8)}</CardTitle>
            <CardDescription>
              {detail.data === null
                ? 'The instance is being loaded.'
                : `State ${detail.data.instance.currentStateKey} · version ${detail.data.instance.version}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {detail.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : detail.data === null ? (
              <p className="text-sm text-muted-foreground">The instance could not be loaded.</p>
            ) : (
              <>
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Tasks</h3>
                  {detail.data.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks were raised.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border">
                      {detail.data.tasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex flex-wrap items-center gap-3 py-2 text-sm"
                        >
                          <Badge variant={TASK_TONE[task.status] ?? 'outline'}>{task.status}</Badge>
                          <span className="font-medium">{task.stepKey}</span>
                          {task.requiredPermission !== null && (
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {task.requiredPermission}
                            </code>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {task.assigneeUserId === null
                              ? 'unassigned'
                              : task.assigneeUserId.slice(0, 8)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Transitions</h3>
                  {detail.data.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transitions recorded yet.</p>
                  ) : (
                    <ol className="flex flex-col divide-y divide-border">
                      {detail.data.history.map((event) => (
                        <li
                          key={event.id}
                          className="flex flex-wrap items-center gap-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {event.fromStateKey ?? '∅'} → {event.toStateKey}
                          </span>
                          <span className="font-medium">{event.transitionName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(event.createdAt)}
                          </span>
                          {event.comment !== null && (
                            <span className="text-xs text-muted-foreground">“{event.comment}”</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
