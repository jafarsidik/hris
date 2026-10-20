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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ApiRequestError } from '@/lib/api/http-client';
import { Check, Copy, Plus } from 'lucide-react';

import {
  CLIENT_BUILT_IN_VIEWS,
  CLIENT_SEARCH_TEXT,
  CLIENT_VIEWS_STORAGE_KEY,
  buildClientColumns,
  buildClientFilters,
} from './client-table-config';
import type { DeveloperApiClient } from './developer-types';
import { getDevelopers } from './index';
import { ScopePicker } from './scope-picker';

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

interface ClientFormState {
  name: string;
  description: string;
  scopes: readonly string[];
}

function stateFromClient(client: DeveloperApiClient | null): ClientFormState {
  return {
    name: client?.name ?? '',
    description: client?.description ?? '',
    scopes: client?.scopes ?? [],
  };
}

/** Create/edit form for an API client. */
function ClientDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly client: DeveloperApiClient | null;
  readonly onSaved: (issued: { name: string; secret: string } | null) => void;
}) {
  const repository = getDevelopers();
  const [form, setForm] = useState<ClientFormState>(() => stateFromClient(client));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(stateFromClient(client));
      setError(undefined);
    }
  }, [open, client]);

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      const description = form.description.trim();
      if (client === null) {
        const created = await repository.createClient({
          name: form.name,
          ...(description === '' ? {} : { description }),
          scopes: form.scopes,
        });
        onOpenChange(false);
        onSaved({ name: created.name, secret: created.secret });
      } else {
        await repository.updateClient(client.id, {
          name: form.name,
          description,
          scopes: form.scopes,
        });
        onOpenChange(false);
        onSaved(null);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client === null ? 'Add an API client' : 'Edit API client'}</DialogTitle>
          <DialogDescription>
            An API client is a machine identity with its own key and a set of scopes. It can never
            exceed the scopes its creator holds.
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
            label="Name"
            htmlFor="client-name"
            required
            error={undefined}
            errorId="client-name-error"
          >
            <Input
              id="client-name"
              autoComplete="off"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              required
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="client-description"
            error={undefined}
            errorId="client-description-error"
            hint="Optional. What the client is for and who owns it."
          >
            <Textarea
              id="client-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
            />
          </FormField>
          <ScopePicker
            label="Scopes"
            value={form.scopes}
            onChange={(scopes) => setForm({ ...form, scopes })}
          />
          <DialogFooter>
            <FormSubmitButton pending={pending} pendingText="Saving…">
              {client === null ? 'Create client' : 'Save changes'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rotates a client's secret, then reveals the new one exactly once. */
function RotateDialog({
  client,
  onOpenChange,
  onRotated,
}: {
  readonly client: DeveloperApiClient | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRotated: (issued: { name: string; secret: string }) => void;
}) {
  const repository = getDevelopers();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirm() {
    if (client === null) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const rotated = await repository.rotateClient(client.id);
      onOpenChange(false);
      onRotated({ name: rotated.name, secret: rotated.secret });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={client !== null} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Rotate secret</DialogTitle>
          <DialogDescription>
            Issue a new secret for &ldquo;{client?.name}&rdquo;? The current secret stops working
            immediately.
          </DialogDescription>
        </DialogHeader>
        {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => void confirm()}>
            {pending ? 'Rotating…' : 'Rotate secret'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reveals a freshly issued secret once, because the API never returns it again. */
function SecretDialog({
  issued,
  onOpenChange,
}: {
  readonly issued: { name: string; secret: string } | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (issued !== null) {
      setCopied(false);
    }
  }, [issued]);

  async function copy() {
    if (issued === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issued.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open={issued !== null} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Secret for {issued?.name}</DialogTitle>
          <DialogDescription>
            Copy this secret now. It is shown once and cannot be retrieved again — rotate the client
            to issue a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={issued?.secret ?? ''} className="font-mono text-xs" />
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The developer API client management screen.
 *
 * Lists the tenant's machine identities and lets an administrator create, edit, rotate and
 * delete them. Reads require `api-client.view`; each mutation is gated by its own
 * `api-client.*` permission, so the buttons here are affordances rather than the boundary.
 */
export function ClientsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const repository = getDevelopers();
  const canCreate = useCan('api-client.create');
  const canUpdate = useCan('api-client.update');
  const canDelete = useCan('api-client.delete');

  const list = useIamLoad(() => repository.listClients(), []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeveloperApiClient | null>(null);
  const [rotateTarget, setRotateTarget] = useState<DeveloperApiClient | null>(null);
  const [issued, setIssued] = useState<{ name: string; secret: string } | null>(null);

  /*
   * One pending destructive change at a time, whether it came from the row menu. Deleting
   * and disabling both cut a machine identity off, so both are routed through a dialog that
   * names the client and the consequence; enabling is the safe direction and stays a single
   * click, exactly as the users directory treats activation.
   */
  const [deleting, setDeleting] = useState<DeveloperApiClient | null>(null);
  const [disabling, setDisabling] = useState<DeveloperApiClient | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  async function confirmDelete(): Promise<void> {
    if (deleting === null) {
      return;
    }
    setPending(true);
    setConfirmError(undefined);
    try {
      await repository.deleteClient(deleting.id);
      toast({
        title: 'Client deleted',
        description: `${deleting.name} can no longer authenticate; every request using its key will fail.`,
        variant: 'success',
      });
      setDeleting(null);
      list.reload();
    } catch (err) {
      setConfirmError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  async function confirmDisable(): Promise<void> {
    if (disabling === null) {
      return;
    }
    setPending(true);
    setConfirmError(undefined);
    try {
      await repository.updateClient(disabling.id, { isActive: false });
      toast({
        title: 'Client disabled',
        description: `${disabling.name} can no longer authenticate until it is enabled again.`,
        variant: 'success',
      });
      setDisabling(null);
      list.reload();
    } catch (err) {
      setConfirmError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  async function enable(client: DeveloperApiClient): Promise<void> {
    try {
      await repository.updateClient(client.id, { isActive: true });
      toast({
        title: 'Client enabled',
        description: `${client.name} can authenticate again.`,
        variant: 'success',
      });
      list.reload();
    } catch (err) {
      toast({
        title: 'The change could not be applied',
        description: messageOf(err),
        variant: 'error',
      });
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(client: DeveloperApiClient) {
    setEditing(client);
    setDialogOpen(true);
  }

  function requestToggleActive(client: DeveloperApiClient): void {
    if (client.isActive) {
      setConfirmError(undefined);
      setDisabling(client);
    } else {
      void enable(client);
    }
  }

  const rows = list.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="API Clients"
        description="Machine credentials with scoped access to the developer API."
      />

      <HrisDataTable
        rows={rows}
        columns={buildClientColumns({
          canUpdate,
          canDelete,
          onEdit: openEdit,
          onRotate: (client) => setRotateTarget(client),
          onToggleActive: requestToggleActive,
          onDelete: (client) => {
            setConfirmError(undefined);
            setDeleting(client);
          },
        })}
        filters={buildClientFilters()}
        searchable
        searchText={CLIENT_SEARCH_TEXT}
        searchPlaceholder="Search by name, client id or scope…"
        selectable={false}
        views={{ builtIn: CLIENT_BUILT_IN_VIEWS, storageKey: CLIENT_VIEWS_STORAGE_KEY }}
        status={list.loading ? 'loading' : list.error !== undefined ? 'error' : 'ready'}
        errorCopy={list.error}
        onRetry={list.reload}
        emptyTitle="No API clients yet"
        emptyDescription="Create a client to issue a machine key with scoped access to the developer API."
        noResultsTitle="No API clients match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every client."
        actions={
          canCreate ? (
            <Button variant="default" onClick={openCreate}>
              <Plus aria-hidden="true" className="size-4" />
              Add client
            </Button>
          ) : undefined
        }
      />

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editing}
        onSaved={(nextIssued) => {
          list.reload();
          setIssued(nextIssued);
        }}
      />
      <RotateDialog
        client={rotateTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRotateTarget(null);
          }
        }}
        onRotated={(nextIssued) => {
          list.reload();
          setIssued(nextIssued);
        }}
      />
      <SecretDialog issued={issued} onOpenChange={(open) => !open && setIssued(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setConfirmError(undefined);
          }
        }}
        title={deleting !== null ? `Delete ${deleting.name}?` : 'Delete client?'}
        description="Any request using its key will fail immediately."
        confirmLabel="Delete"
        tone="destructive"
        pending={pending}
        error={confirmError}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={disabling !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDisabling(null);
            setConfirmError(undefined);
          }
        }}
        title={disabling !== null ? `Disable ${disabling.name}?` : 'Disable client?'}
        description="Any request using its key will fail until the client is enabled again."
        confirmLabel="Disable"
        tone="destructive"
        pending={pending}
        error={confirmError}
        onConfirm={() => void confirmDisable()}
      />
    </PageBody>
  );
}
