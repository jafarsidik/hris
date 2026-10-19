'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus, Trash2 } from 'lucide-react';

import type { ServiceAccountSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { serviceAccountsApi } from '@/features/governance/service-accounts-api';
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

export function ServiceAccountsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const accounts = useIamLoad(() => serviceAccountsApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<{ id: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [key, setKey] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setKey('');
    setExpiresAt('');
  };

  const submit = async () => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      const result = await serviceAccountsApi.create({
        name,
        description: description.trim() === '' ? null : description,
        key,
        expiresAt: expiresAt || undefined,
      });
      setNotice('Service account created.');
      setShowSecret({ id: result.summary.id, secret: result.secret });
      resetForm();
      setOpen(false);
      accounts.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (id: string) => {
    setError(undefined);
    setBusy(true);
    try {
      const result = await serviceAccountsApi.rotateSecret(id);
      setNotice('Secret rotated.');
      setShowSecret({ id, secret: result.secret });
      accounts.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, n: string) => {
    if (!window.confirm(`Delete “${n}"?`)) {
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await serviceAccountsApi.remove(id);
      setNotice(`Deleted “${n}".`);
      accounts.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: ServiceAccountSummary) => {
    setError(undefined);
    try {
      await serviceAccountsApi.update(a.id, { isActive: !a.isActive });
      accounts.reload();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  const rows = (accounts.data ?? []) as ServiceAccountSummary[];

  return (
    <PageBody>
      <PageHeader title="Service Accounts" description="Non-human identities for automation." />

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

      {accounts.loading && rows.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No service accounts.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Service accounts</CardTitle>
            <CardDescription>
              {rows.length} account{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="font-mono text-sm">{a.key}</TableCell>
                    <TableCell>
                      <Badge variant={a.isActive ? 'success' : 'secondary'}>
                        {a.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{a.expiresAt ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void rotate(a.id)}>
                            Rotate secret
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void toggle(a)}>
                            {a.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(a.id, a.name)}
                          >
                            <Trash2 className="mr-1 size-4" aria-hidden />
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showSecret !== null && (
        <Dialog open={true} onOpenChange={(o) => setShowSecret(o ? showSecret : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Secret shown once</DialogTitle>
              <DialogDescription>
                Copy the secret now. It will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <FormField
              label="Secret"
              htmlFor="service-account-secret"
              errorId="service-account-secret-error"
            >
              <Input id="service-account-secret" value={showSecret.secret} readOnly />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(showSecret.secret);
                }}
              >
                <Copy className="mr-1 size-4" /> Copy
              </Button>
            </FormField>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSecret(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <Plus className="mr-1 size-4" />
                Create service account
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create service account</DialogTitle>
              <DialogDescription>
                A non-human identity for automation, scoped to this tenant.
              </DialogDescription>
            </DialogHeader>
            {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <FormField label="Name" htmlFor="sa-name" required errorId="sa-name-error">
                <Input id="sa-name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
              </FormField>
              <FormField
                label="Description"
                htmlFor="sa-description"
                errorId="sa-description-error"
              >
                <Input
                  id="sa-description"
                  value={description}
                  onChange={(e) => setDescription(e.currentTarget.value)}
                />
              </FormField>
              <FormField label="Key" htmlFor="sa-key" required errorId="sa-key-error">
                <Input
                  id="sa-key"
                  value={key}
                  onChange={(e) => setKey(e.currentTarget.value)}
                  placeholder="e.g. payroll-sync"
                />
              </FormField>
              <FormField label="Expires at" htmlFor="sa-expires" errorId="sa-expires-error">
                <Input
                  id="sa-expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.currentTarget.value)}
                />
              </FormField>
              <DialogFooter>
                <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <FormSubmitButton pending={busy} disabled={name.trim() === '' || key.trim() === ''}>
                  Create
                </FormSubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </PageBody>
  );
}
