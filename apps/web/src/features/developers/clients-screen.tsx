'use client';

import { useEffect, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
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
import { Check, Copy, Plus } from 'lucide-react';

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
  const repository = getDevelopers();
  const canCreate = useCan('api-client.create');
  const canUpdate = useCan('api-client.update');
  const canDelete = useCan('api-client.delete');

  const [clients, setClients] = useState<DeveloperApiClient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeveloperApiClient | null>(null);
  const [rotateTarget, setRotateTarget] = useState<DeveloperApiClient | null>(null);
  const [issued, setIssued] = useState<{ name: string; secret: string } | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void repository.listClients().then(
      (rows) => {
        if (active) {
          setClients([...rows]);
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
          error instanceof ApiRequestError ? error.message : 'The API clients could not be loaded.',
        );
      },
    );
    return () => {
      active = false;
    };
  }, [repository, tick]);

  const reload = () => setTick((value) => value + 1);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(client: DeveloperApiClient) {
    setEditing(client);
    setDialogOpen(true);
  }

  return (
    <PageBody>
      <PageHeader
        title="API Clients"
        description="Machine credentials with scoped access to the developer API."
      />

      <PageToolbar className="justify-end">
        {canCreate && (
          <Button variant="default" onClick={openCreate}>
            <Plus aria-hidden="true" className="size-4" />
            Add client
          </Button>
        )}
      </PageToolbar>

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
              <TableHead>Client ID</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(clients ?? []).map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell className="font-mono text-xs">{client.clientId}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{client.scopes.length}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={client.isActive ? 'success' : 'outline'}>
                    {client.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimestamp(client.lastUsedAt)}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  {canUpdate && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(client)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRotateTarget(client)}>
                        Rotate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await repository.updateClient(client.id, { isActive: !client.isActive });
                          reload();
                        }}
                      >
                        {client.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <ConfirmDelete
                      label="Delete"
                      description={`Delete "${client.name}"? Any request using its key will fail immediately.`}
                      onConfirm={async () => {
                        await repository.deleteClient(client.id);
                        reload();
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(clients ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No API clients yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editing}
        onSaved={(nextIssued) => {
          reload();
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
          reload();
          setIssued(nextIssued);
        }}
      />
      <SecretDialog issued={issued} onOpenChange={(open) => !open && setIssued(null)} />
    </PageBody>
  );
}
