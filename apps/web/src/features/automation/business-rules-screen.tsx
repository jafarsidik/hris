'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Power } from 'lucide-react';

import type { BusinessRuleAction, BusinessRuleSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
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
import { businessRulesApi } from '@/features/automation/business-rules-api';
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

export function BusinessRulesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const rules = useIamLoad(() => businessRulesApi.list(), []);
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
  const [eventType, setEventType] = useState('');
  const [conditionText, setConditionText] = useState('{}');
  const [actionsText, setActionsText] = useState('[]');
  const [priority, setPriority] = useState(100);
  const [isEnabled, setIsEnabled] = useState(true);

  const resetForm = () => {
    setName('');
    setDescription('');
    setEventType('');
    setConditionText('{}');
    setActionsText('[]');
    setPriority(100);
    setIsEnabled(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    let condition: Record<string, unknown>;
    let actions: readonly BusinessRuleAction[];
    try {
      condition = JSON.parse(conditionText) as Record<string, unknown>;
    } catch {
      setError('Condition is not valid JSON.');
      return;
    }
    try {
      actions = JSON.parse(actionsText) as BusinessRuleAction[];
    } catch {
      setError('Actions is not valid JSON.');
      return;
    }
    setBusy(true);
    try {
      await businessRulesApi.create({
        name,
        description: description.trim() === '' ? null : description,
        eventType,
        condition,
        actions,
        priority,
        isEnabled,
      });
      setNotice(`Created "${name}".`);
      resetForm();
      setShowForm(false);
      rules.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [name, description, eventType, conditionText, actionsText, priority, isEnabled, rules]);

  const remove = useCallback(
    async (id: string, n: string) => {
      if (!window.confirm(`Delete "${n}"?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await businessRulesApi.remove(id);
        setNotice(`Deleted "${n}".`);
        rules.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [rules],
  );

  const toggle = useCallback(
    async (rule: BusinessRuleSummary) => {
      setError(undefined);
      try {
        await businessRulesApi.toggle(rule.id, !rule.isEnabled);
        rules.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [rules],
  );

  const rows = rules.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Business Rules"
        description="Conditional logic evaluated at runtime when a domain event fires."
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
                <CardTitle>New rule</CardTitle>
                <CardDescription>
                  Actions run when the trigger event matches the condition (in priority order).
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="mr-1 size-4" />
                {showForm ? 'Hide' : 'New rule'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rule-name">Name</Label>
                  <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rule-event">Trigger event</Label>
                  <Input
                    id="rule-event"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    placeholder="task.completed"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rule-description">Description (optional)</Label>
                <Input
                  id="rule-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rule-condition">Condition (JSON)</Label>
                  <Textarea
                    id="rule-condition"
                    value={conditionText}
                    onChange={(e) => setConditionText(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rule-actions">Actions (JSON array)</Label>
                  <Textarea
                    id="rule-actions"
                    value={actionsText}
                    onChange={(e) => setActionsText(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rule-priority">Priority</Label>
                  <Input
                    id="rule-priority"
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEnabled(!isEnabled)}>
                  <Power className="mr-1 size-4" />
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={() => void submit()}
                  disabled={busy || name.trim() === '' || eventType.trim() === ''}
                >
                  {busy ? 'Creating…' : 'Create rule'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            {rules.loading ? 'Loading…' : `${rows.length} rule${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{rules.error}</AlertDescription>
            </Alert>
          )}
          {rules.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell className="font-mono text-sm">{rule.eventType}</TableCell>
                    <TableCell className="text-muted-foreground">{rule.actions.length}</TableCell>
                    <TableCell className="font-mono">{rule.priority}</TableCell>
                    <TableCell>
                      <Badge variant={rule.isEnabled ? 'success' : 'secondary'}>
                        {rule.isEnabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void toggle(rule)}>
                            {rule.isEnabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(rule.id, rule.name)}
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
