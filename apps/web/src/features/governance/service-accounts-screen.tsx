'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus } from 'lucide-react';

import type { ServiceAccountSummary } from '@hris/shared-types';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { serviceAccountsApi } from '@/features/governance/service-accounts-api';
import {
  SERVICE_ACCOUNT_BUILT_IN_VIEWS,
  SERVICE_ACCOUNT_SEARCH_TEXT,
  SERVICE_ACCOUNT_VIEWS_STORAGE_KEY,
  buildServiceAccountColumns,
  buildServiceAccountFilters,
} from '@/features/governance/service-accounts-table-config';
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

  const [confirming, setConfirming] = useState<{
    readonly account: ServiceAccountSummary;
    readonly action: 'delete' | 'disable';
  } | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

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

  const toggle = async (a: ServiceAccountSummary) => {
    setError(undefined);
    try {
      await serviceAccountsApi.update(a.id, { isActive: !a.isActive });
      accounts.reload();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  const confirmAction = async () => {
    if (confirming === null) {
      return;
    }
    setConfirmPending(true);
    setConfirmError(undefined);
    try {
      if (confirming.action === 'delete') {
        await serviceAccountsApi.remove(confirming.account.id);
        setNotice(`Deleted "${confirming.account.name}".`);
      } else {
        await serviceAccountsApi.update(confirming.account.id, { isActive: false });
        setNotice(`Disabled "${confirming.account.name}".`);
      }
      setConfirming(null);
      accounts.reload();
    } catch (cause) {
      setConfirmError(messageOf(cause));
    } finally {
      setConfirmPending(false);
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

      <HrisDataTable
        rows={rows}
        columns={buildServiceAccountColumns({
          canManage,
          onRotate: (account) => void rotate(account.id),
          onToggle: (account) => {
            if (account.isActive) {
              setConfirmError(undefined);
              setConfirming({ account, action: 'disable' });
            } else {
              void toggle(account);
            }
          },
          onDelete: (account) => {
            setConfirmError(undefined);
            setConfirming({ account, action: 'delete' });
          },
        })}
        filters={buildServiceAccountFilters(rows)}
        searchable
        searchText={SERVICE_ACCOUNT_SEARCH_TEXT}
        searchPlaceholder="Search by name or key…"
        selectable={false}
        views={{
          builtIn: SERVICE_ACCOUNT_BUILT_IN_VIEWS,
          storageKey: SERVICE_ACCOUNT_VIEWS_STORAGE_KEY,
        }}
        status={accounts.loading ? 'loading' : accounts.error !== undefined ? 'error' : 'ready'}
        errorCopy={accounts.error}
        onRetry={() => accounts.reload()}
        emptyTitle="No service accounts"
        emptyDescription="Create a service account for non-human identities used in automation."
        noResultsTitle="No accounts match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every account."
      />

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

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setConfirming(null);
            setConfirmError(undefined);
          }
        }}
        title={
          confirming?.action === 'delete'
            ? `Delete "${confirming?.account.name}"?`
            : `Disable "${confirming?.account.name}"?`
        }
        description={
          confirming?.action === 'delete' ? (
            <>
              The service account and its API access are permanently removed. Any automation using
              its credentials will fail until new credentials are issued.
            </>
          ) : (
            <>
              The service account keeps its configuration but can no longer authenticate. Any
              automation using its credentials will fail until it is enabled again.
            </>
          )
        }
        confirmLabel={confirming?.action === 'delete' ? 'Delete' : 'Disable'}
        tone="destructive"
        pending={confirmPending}
        error={confirmError}
        onConfirm={() => void confirmAction()}
      />
    </PageBody>
  );
}
