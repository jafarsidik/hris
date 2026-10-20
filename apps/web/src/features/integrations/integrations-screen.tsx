'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';
import {
  INTEGRATION_KINDS,
  type IntegrationKind,
  type IntegrationSummary,
} from '@hris/shared-types';
import { Plus } from 'lucide-react';

import { getIntegrations } from './index';
import { KIND_LABELS } from './integration-presentation';
import {
  INTEGRATION_BUILT_IN_VIEWS,
  INTEGRATION_SEARCH_TEXT,
  INTEGRATION_VIEWS_STORAGE_KEY,
  buildIntegrationColumns,
  buildIntegrationFilters,
} from './integration-table-config';

/** Turns an unknown rejection into a message a form or notice can render inline. */
function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

interface IntegrationFormState {
  key: string;
  name: string;
  kind: IntegrationKind;
  provider: string;
  isEnabled: boolean;
  configText: string;
  events: string;
}

function stateFromIntegration(integration: IntegrationSummary | null): IntegrationFormState {
  return {
    key: integration?.key ?? '',
    name: integration?.name ?? '',
    kind: integration?.kind ?? 'EMAIL',
    provider: integration?.provider ?? '',
    isEnabled: integration?.isEnabled ?? true,
    configText: JSON.stringify(integration?.config ?? {}, null, 2),
    events: '',
  };
}

/** Create/edit form for an integration. */
function IntegrationDialog({
  open,
  onOpenChange,
  integration,
  defaultKind,
  onSaved,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly integration: IntegrationSummary | null;
  readonly defaultKind: IntegrationKind;
  readonly onSaved: () => void;
}) {
  const repository = getIntegrations();
  const [form, setForm] = useState<IntegrationFormState>(() => stateFromIntegration(integration));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        integration === null
          ? { ...stateFromIntegration(null), kind: defaultKind }
          : stateFromIntegration(integration),
      );
      setError(undefined);
    }
  }, [open, integration, defaultKind]);

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      let config: Record<string, unknown>;
      try {
        const parsed = form.configText.trim() === '' ? {} : JSON.parse(form.configText);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Configuration must be a JSON object.');
        }
        config = parsed as Record<string, unknown>;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The configuration is not valid JSON.');
        return;
      }

      if (integration === null) {
        await repository.createIntegration({
          key: form.key,
          name: form.name,
          kind: form.kind,
          provider: form.provider,
          config,
          isEnabled: form.isEnabled,
          ...(form.kind === 'WEBHOOK'
            ? {
                events: form.events
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }
            : {}),
        });
      } else {
        await repository.updateIntegration(integration.id, {
          name: form.name,
          kind: form.kind,
          provider: form.provider,
          config,
          isEnabled: form.isEnabled,
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  const isWebhook = form.kind === 'WEBHOOK';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {integration === null ? 'Add an integration' : 'Edit integration'}
          </DialogTitle>
          <DialogDescription>
            An integration is one external system for this tenant. Configuration holds non-secret
            settings only; store credentials in System Settings.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
          <FormField
            label="Key"
            htmlFor="integration-key"
            required
            error={undefined}
            errorId="integration-key-error"
          >
            <Input
              id="integration-key"
              autoComplete="off"
              value={form.key}
              disabled={integration !== null}
              onChange={(event) => setForm({ ...form, key: event.currentTarget.value })}
              required
            />
          </FormField>
          <FormField
            label="Name"
            htmlFor="integration-name"
            required
            error={undefined}
            errorId="integration-name-error"
          >
            <Input
              id="integration-name"
              autoComplete="off"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              required
            />
          </FormField>
          <FormField
            label="Kind"
            htmlFor="integration-kind"
            error={undefined}
            errorId="integration-kind-error"
          >
            <Select
              value={form.kind}
              onValueChange={(value) => {
                if (value !== null) {
                  setForm({ ...form, kind: value as IntegrationKind });
                }
              }}
            >
              <SelectTrigger id="integration-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTEGRATION_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Provider"
            htmlFor="integration-provider"
            required
            error={undefined}
            errorId="integration-provider-error"
          >
            <Input
              id="integration-provider"
              autoComplete="off"
              value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.currentTarget.value })}
              required
            />
          </FormField>
          {isWebhook && (
            <FormField
              label="Event types"
              htmlFor="integration-events"
              error={undefined}
              errorId="integration-events-error"
              hint="Comma-separated. Use * to subscribe to every event."
            >
              <Input
                id="integration-events"
                autoComplete="off"
                placeholder="user.welcome, task.completed"
                value={form.events}
                onChange={(event) => setForm({ ...form, events: event.currentTarget.value })}
              />
            </FormField>
          )}
          <FormField
            label="Configuration (JSON)"
            htmlFor="integration-config"
            error={undefined}
            errorId="integration-config-error"
            hint={
              isWebhook
                ? 'A webhook requires an absolute http(s) url, for example {"url": "https://…"}.'
                : 'Non-secret settings as a JSON object.'
            }
          >
            <Textarea
              id="integration-config"
              className="font-mono text-xs"
              value={form.configText}
              onChange={(event) => setForm({ ...form, configText: event.currentTarget.value })}
            />
          </FormField>
          <div className="flex items-center gap-2 text-sm">
            <Switch
              aria-label="Enabled"
              checked={form.isEnabled}
              onCheckedChange={(next) => setForm({ ...form, isEnabled: next })}
            />
            Enabled
          </div>
          <DialogFooter>
            <FormSubmitButton pending={pending} pendingText="Saving…">
              {integration === null ? 'Create integration' : 'Save changes'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The integration registry screen.
 *
 * Lists the tenant's configured integrations and lets an administrator register, edit,
 * delete and test them, then open one for its delivery log, subscriptions and signing
 * secret. Reads require `integration.view`; each mutation is gated by its own
 * `integration.*` permission, so the buttons here are affordances rather than the
 * boundary.
 *
 * Rendered twice: the full registry (Integrations) and a webhook-only view (Webhooks).
 * The `kindFilter` narrows the list; the API and the detail screen are shared.
 */
export function IntegrationsScreen({
  kindFilter,
  title = 'Integrations',
  description = 'External systems this tenant talks to, with their health and delivery log.',
  createKind,
}: {
  readonly kindFilter?: IntegrationKind;
  readonly title?: string;
  readonly description?: string;
  readonly createKind?: IntegrationKind;
}) {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const repository = getIntegrations();
  const canCreate = useCan('integration.create');
  const canUpdate = useCan('integration.update');
  const canDelete = useCan('integration.delete');
  const canManage = useCan('integration.manage');

  const [rows, setRows] = useState<readonly IntegrationSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [tick, setTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationSummary | null>(null);
  const [testingId, setTestingId] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [deleting, setDeleting] = useState<IntegrationSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void repository.listIntegrations().then(
      (integrations) => {
        if (active) {
          setRows(integrations);
          setLoading(false);
          setLoadError(undefined);
        }
      },
      (error: unknown) => {
        if (!active) {
          return;
        }
        setLoading(false);
        setLoadError(
          error instanceof ApiRequestError
            ? error.message
            : 'The integrations could not be loaded.',
        );
      },
    );
    return () => {
      active = false;
    };
  }, [repository, tick]);

  const reload = () => setTick((value) => value + 1);
  const visible = (rows ?? []).filter((row) => kindFilter === undefined || row.kind === kindFilter);

  // This screen renders twice — the whole registry and a webhook-only view — so the empty
  // copy has to name what the page actually lists. "No integrations yet" on the Webhooks
  // page would be false the moment any non-webhook integration exists.
  const noun = kindFilter === 'WEBHOOK' ? 'webhook' : 'integration';
  const article = kindFilter === 'WEBHOOK' ? 'a' : 'an';

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function runTest(id: string) {
    setTestingId(id);
    setNotice(undefined);
    try {
      const result = await repository.testIntegration(id);
      setNotice(`${result.ok ? 'Connected' : 'Failed'}: ${result.message}`);
      reload();
    } catch (err) {
      setNotice(messageOf(err));
    } finally {
      setTestingId(undefined);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) {
      return;
    }
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await repository.deleteIntegration(deleting.id);
      toast({
        title: 'Integration deleted',
        description: `${deleting.name} and its delivery history were removed.`,
        variant: 'success',
      });
      setDeleting(null);
      reload();
    } catch (err) {
      setDeleteError(messageOf(err));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <PageBody>
      <PageHeader title={title} description={description} />

      {notice !== undefined && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <HrisDataTable
        rows={visible}
        columns={buildIntegrationColumns({
          canManage,
          canUpdate,
          canDelete,
          testingId,
          onOpen: (integration) => router.push(`/setup/integrations/${integration.id}`),
          onTest: (integration) => void runTest(integration.id),
          onEdit: (integration) => {
            setEditing(integration);
            setDialogOpen(true);
          },
          onDelete: (integration) => setDeleting(integration),
        })}
        filters={buildIntegrationFilters(visible)}
        searchable
        searchText={INTEGRATION_SEARCH_TEXT}
        searchPlaceholder="Search integrations by name, key, provider…"
        selectable={false}
        views={{ builtIn: INTEGRATION_BUILT_IN_VIEWS, storageKey: INTEGRATION_VIEWS_STORAGE_KEY }}
        status={loading ? 'loading' : loadError !== undefined ? 'error' : 'ready'}
        errorCopy={loadError}
        onRetry={reload}
        emptyTitle={`No ${noun}s yet`}
        emptyDescription={`Register ${article} ${noun} to connect this tenant to an external system.`}
        noResultsTitle={`No ${noun}s match this filter`}
        noResultsDescription={`Try a different search or status, or clear the filters to see every ${noun}.`}
        actions={
          canCreate ? (
            <Button variant="default" onClick={openCreate}>
              <Plus aria-hidden="true" className="size-4" />
              Add integration
            </Button>
          ) : undefined
        }
      />

      <IntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        integration={editing}
        defaultKind={createKind ?? 'EMAIL'}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete ${deleting?.name ?? 'this integration'}?`}
        description="The integration, its delivery history and its subscriptions are removed. This cannot be undone."
        confirmLabel="Delete"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
