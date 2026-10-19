'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Power, Play } from 'lucide-react';

import type { ScheduledActionSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCan, useSession } from '@/features/auth/session-context';
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

  const remove = useCallback(
    async (id: string, n: string) => {
      if (!window.confirm(`Delete "${n}"?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await scheduledActionsApi.remove(id);
        setNotice(`Deleted "${n}".`);
        items.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [items],
  );

  const toggle = useCallback(
    async (rule: ScheduledActionSummary) => {
      setError(undefined);
      try {
        await scheduledActionsApi.toggle(rule.id, !rule.isEnabled);
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

  const rows = items.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Scheduled Actions"
        description="Time-based automation and recurring work."
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

      <Card>
        <CardHeader>
          <CardTitle>Scheduled actions</CardTitle>
          <CardDescription>
            {items.loading ? 'Loading…' : `${rows.length} action${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{items.error}</AlertDescription>
            </Alert>
          )}
          {items.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No scheduled actions" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Cron</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-sm">{row.cron}</TableCell>
                    <TableCell className="text-muted-foreground">{row.nextRunAt ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.lastRunAt ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={row.isEnabled ? 'success' : 'secondary'}>
                        {row.isEnabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void toggle(row)}>
                            {row.isEnabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void runNow(row.id)}>
                            <Play className="mr-1 size-3" />
                            Run now
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(row.id, row.name)}
                          >
                            <Trash2 className="mr-1 size-4" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
