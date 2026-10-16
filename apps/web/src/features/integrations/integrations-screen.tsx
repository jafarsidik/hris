'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCan, useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';
import {
  INTEGRATION_KINDS,
  type IntegrationKind,
  type IntegrationSummary,
} from '@hris/shared-types';
import { Plus } from 'lucide-react';

import { getIntegrations } from './index';
import { KIND_LABELS, statusBadgeVariant } from './integration-presentation';

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

function formatTimestamp(value: string | null): string {
  if (value === null) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/** Confirms a destructive action in a dialog and surfaces whatever the API rejects with. */
function ConfirmDelete({
  label,
  description,
  onConfirm,
}: {
  readonly label: string;
  readonly description: string;
  readonly onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(undefined);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            {label}
          </Button>
        }
      />
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
            {pending ? 'Deleting…' : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [testing, setTesting] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

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

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function runTest(id: string) {
    setTesting(id);
    setNotice(undefined);
    try {
      const result = await repository.testIntegration(id);
      setNotice(`${result.ok ? 'Connected' : 'Failed'}: ${result.message}`);
      reload();
    } catch (err) {
      setNotice(messageOf(err));
    } finally {
      setTesting(undefined);
    }
  }

  return (
    <PageBody>
      <PageHeader title={title} description={description} />

      <PageToolbar className="justify-end">
        {canCreate && (
          <Button variant="default" onClick={openCreate}>
            <Plus aria-hidden="true" className="size-4" />
            Add integration
          </Button>
        )}
      </PageToolbar>

      {notice !== undefined && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : loadError !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last checked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/setup/integrations/${row.id}`} className="hover:underline">
                    {row.name}
                  </Link>
                  {!row.isEnabled && (
                    <Badge variant="outline" className="ml-2">
                      Disabled
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.key}</TableCell>
                <TableCell>{KIND_LABELS[row.kind]}</TableCell>
                <TableCell>{row.provider}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimestamp(row.lastCheckedAt)}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/setup/integrations/${row.id}`} />}
                  >
                    Open
                  </Button>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={testing === row.id}
                      onClick={() => void runTest(row.id)}
                    >
                      {testing === row.id ? 'Testing…' : 'Test'}
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(row);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <ConfirmDelete
                      label="Delete"
                      description={`Delete "${row.name}"? Its delivery history and subscriptions are removed too.`}
                      onConfirm={async () => {
                        await repository.deleteIntegration(row.id);
                        reload();
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No integrations yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <IntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        integration={editing}
        defaultKind={createKind ?? 'EMAIL'}
        onSaved={reload}
      />
    </PageBody>
  );
}
