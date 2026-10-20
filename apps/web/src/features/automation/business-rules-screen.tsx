'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Power } from 'lucide-react';

import type { BusinessRuleAction, BusinessRuleSummary } from '@hris/shared-types';

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
  BUSINESS_RULE_BUILT_IN_VIEWS,
  BUSINESS_RULE_SEARCH_TEXT,
  BUSINESS_RULE_VIEWS_STORAGE_KEY,
  buildBusinessRuleColumns,
  buildBusinessRuleFilters,
} from '@/features/automation/business-rules-table-config';
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
  const { toast } = useToast();
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

  const [deleting, setDeleting] = useState<BusinessRuleSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

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

  const confirmDelete = useCallback(async () => {
    if (deleting === null) {
      return;
    }
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await businessRulesApi.remove(deleting.id);
      toast({
        title: 'Rule deleted',
        description: `"${deleting.name}" will no longer fire.`,
        variant: 'success',
      });
      setDeleting(null);
      rules.reload();
    } catch (cause) {
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  }, [deleting, rules, toast]);

  const rows = rules.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Business Rules"
        description="Conditional logic evaluated at runtime when a domain event fires."
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

      <HrisDataTable
        rows={rows}
        columns={buildBusinessRuleColumns(
          canEdit ? { onToggle: toggle, onDelete: (rule) => setDeleting(rule) } : {},
        )}
        filters={buildBusinessRuleFilters(rows)}
        searchable
        searchText={BUSINESS_RULE_SEARCH_TEXT}
        searchPlaceholder="Search rules by name, trigger or description…"
        /*
         * No selection column: there is no bulk rule operation to offer, and a checkbox
         * that only ever leads to "nothing available for 3 selected" is worse than no
         * checkbox.
         */
        selectable={false}
        views={{
          builtIn: BUSINESS_RULE_BUILT_IN_VIEWS,
          storageKey: BUSINESS_RULE_VIEWS_STORAGE_KEY,
        }}
        status={rules.loading ? 'loading' : rules.error !== undefined ? 'error' : 'ready'}
        errorCopy={rules.error}
        onRetry={() => rules.reload()}
        emptyTitle="No rules yet"
        emptyDescription="Create a rule to react to domain events with notifications, workflows or webhooks."
        noResultsTitle="No rules match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every rule."
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete ${deleting?.name ?? 'this rule'}?`}
        description="The rule is removed and will no longer fire when its trigger event occurs. This cannot be undone."
        confirmLabel="Delete rule"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
