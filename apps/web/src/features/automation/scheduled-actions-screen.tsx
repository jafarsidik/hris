'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Power } from 'lucide-react';

import type { ScheduledActionSummary } from '@hris/shared-types';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import {
  SCHEDULED_ACTION_BUILT_IN_VIEWS,
  SCHEDULED_ACTION_SEARCH_TEXT,
  SCHEDULED_ACTION_VIEWS_STORAGE_KEY,
  buildScheduledActionColumns,
  buildScheduledActionFilters,
} from '@/features/automation/scheduled-actions-table-config';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { scheduledActionsApi } from '@/features/automation/scheduled-actions-api';
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The request could not be completed.';
}

export function ScheduledActionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const items = useIamLoad(() => scheduledActionsApi.list(), []);
  const canEdit = useCan('workflow.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [deleting, setDeleting] = useState<ScheduledActionSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cron, setCron] = useState('0 * * * *');
  const [actionText, setActionText] = useState('{"type":"START_WORKFLOW","definitionId":""}');
  const [isEnabled, setIsEnabled] = useState(true);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCron('0 * * * *');
    setActionText('{"type":"START_WORKFLOW","definitionId":""}');
    setIsEnabled(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    let action: Record<string, unknown>;
    try {
      action = JSON.parse(actionText) as Record<string, unknown>;
    } catch {
      setError('Action is not valid JSON.');
      return;
    }
    setBusy(true);
    try {
      await scheduledActionsApi.create({
        name,
        description: description.trim() === '' ? null : description,
        cron,
        action: action as never,
        isEnabled,
      });
      setNotice('Scheduled action created.');
      resetForm();
      setShowForm(false);
      items.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [name, description, cron, actionText, isEnabled, items]);

  const toggle = useCallback(
    async (row: ScheduledActionSummary) => {
      setError(undefined);
      try {
        await scheduledActionsApi.toggle(row.id, !row.isEnabled);
        items.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [items],
  );

  const runNow = useCallback(
    async (id: string) => {
      setError(undefined);
      setNotice(undefined);
      setBusy(true);
      try {
        const outcome = await scheduledActionsApi.runNow(id);
        setNotice(outcome.ok ? 'Action ran successfully.' : `Run failed: ${outcome.error ?? ''}`);
        items.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [items],
  );

  const confirmDelete = useCallback(async () => {
    if (deleting === null) {
      return;
    }
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await scheduledActionsApi.remove(deleting.id);
      toast({
        title: 'Scheduled action deleted',
        description: `"${deleting.name}" will no longer run on its cron schedule.`,
        variant: 'success',
      });
      setDeleting(null);
      items.reload();
    } catch (cause) {
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  }, [deleting, items, toast]);

  const rows = items.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Scheduled Actions"
        description="Time-based automation and recurring work."
      />

      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>New scheduled action</CardTitle>
                <CardDescription>A 5-field cron plus an action (JSON).</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="mr-1 size-4" />
                {showForm ? 'Hide' : 'New'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sa-name">Name</Label>
                  <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sa-cron">Cron</Label>
                  <Input id="sa-cron" value={cron} onChange={(e) => setCron(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sa-description">Description</Label>
                <Input
                  id="sa-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sa-action">Action (JSON)</Label>
                <Textarea
                  id="sa-action"
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-4">
                <Button variant="outline" size="sm" onClick={() => setIsEnabled(!isEnabled)}>
                  <Power className="mr-1 size-4" />
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={busy || name.trim() === '' || cron.trim() === ''}
                >
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildScheduledActionColumns(
          canEdit
            ? {
                onToggle: toggle,
                onRunNow: (id) => void runNow(id),
                onDelete: (row) => setDeleting(row),
              }
            : {},
        )}
        filters={buildScheduledActionFilters(rows)}
        searchable
        searchText={SCHEDULED_ACTION_SEARCH_TEXT}
        searchPlaceholder="Search actions by name, cron or description…"
        /*
         * No selection column: there is no bulk scheduled-action operation to offer, and
         * a checkbox that only ever leads to "nothing available for 3 selected" is worse
         * than no checkbox.
         */
        selectable={false}
        views={{
          builtIn: SCHEDULED_ACTION_BUILT_IN_VIEWS,
          storageKey: SCHEDULED_ACTION_VIEWS_STORAGE_KEY,
        }}
        status={items.loading ? 'loading' : items.error !== undefined ? 'error' : 'ready'}
        errorCopy={items.error}
        onRetry={() => items.reload()}
        emptyTitle="No scheduled actions"
        emptyDescription="Create a scheduled action to run a workflow, notification or event on a cron schedule."
        noResultsTitle="No actions match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every action."
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete ${deleting?.name ?? 'this action'}?`}
        description="The scheduled action is removed and will no longer run on its cron schedule. Runs that already happened are kept in the history. This cannot be undone."
        confirmLabel="Delete action"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
