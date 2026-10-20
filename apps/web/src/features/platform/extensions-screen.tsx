'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  EMPTY_FILTERS,
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { extensionsApi } from '@/features/platform/registry-extensions-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { ExtensionSummary } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

const STATE_FILTER = [
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
];

const withState = (state: 'ENABLED' | 'DISABLED') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

const EXTENSION_VIEWS_STORAGE_KEY = 'hris:extensions:views';

const EXTENSION_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All extensions',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'enabled', name: 'Enabled', builtIn: true, state: withState('ENABLED') },
  { id: 'disabled', name: 'Disabled', builtIn: true, state: withState('DISABLED') },
];

const EXTENSION_FILTERS: readonly DataTableFilter<ExtensionSummary>[] = [
  {
    kind: 'select',
    id: 'state',
    label: 'State',
    placeholder: 'All states',
    getValue: (extension) => (extension.isEnabled ? 'ENABLED' : 'DISABLED'),
    options: STATE_FILTER,
  },
];

/**
 * The extension list's columns.
 *
 * The actions column is pinned because the table scrolls horizontally on narrower
 * windows; an actions cell that scrolls out of sight cannot be clicked. Both actions
 * are offered only to a reader with `registry.manage`.
 */
function buildExtensionColumns({
  canManage,
  onToggle,
  onRemove,
}: {
  readonly canManage: boolean;
  readonly onToggle: (extension: ExtensionSummary) => void;
  readonly onRemove: (extension: ExtensionSummary) => void;
}): readonly DataTableColumn<ExtensionSummary>[] {
  const columns: DataTableColumn<ExtensionSummary>[] = [
    {
      id: 'extensionKey',
      header: 'Key',
      sortValue: (extension) => extension.extensionKey,
      cellClassName: 'font-mono text-sm',
      cell: (extension) => extension.extensionKey,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (extension) => extension.name,
      cellClassName: 'font-medium',
      cell: (extension) => extension.name,
    },
    {
      id: 'version',
      header: 'Version',
      sortValue: (extension) => extension.version,
      cellClassName: 'font-mono text-sm',
      cell: (extension) => extension.version,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (extension) => (extension.isEnabled ? 'ENABLED' : 'DISABLED'),
      cell: (extension) => (
        <Badge variant={extension.isEnabled ? 'success' : 'secondary'}>
          {extension.isEnabled ? 'ENABLED' : 'DISABLED'}
        </Badge>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (extension) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggle(extension)}>
            {extension.isEnabled ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(extension)}>
            <Trash2 className="mr-1 size-4" aria-hidden />
            Delete
          </Button>
        </div>
      ),
    });
  }

  return columns;
}

/**
 * Extension Registry: third-party and customer extensions registered on the platform.
 *
 * The list used to be a bare `<table>` inside a `Card` — no search, no sorting, no
 * pagination, no column visibility — and its delete action was a `window.confirm`,
 * which cannot name the record, cannot say what the deletion costs and cannot report
 * a failure. It now renders through the shared table, and delete goes through the
 * confirm dialog: the extension is named, the consequence is stated, the failure
 * stays inside the dialog, and a success raises a toast.
 */
export function ExtensionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const extensions = useIamLoad(() => extensionsApi.list(), []);
  const canManage = useCan('registry.manage');
  const { toast } = useToast();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [extensionKey, setExtensionKey] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [manifestJson, setManifestJson] = useState('{}');
  const [isEnabled, setIsEnabled] = useState(true);

  const [confirming, setConfirming] = useState<ExtensionSummary | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const resetForm = () => {
    setExtensionKey('');
    setName('');
    setVersion('1.0.0');
    setDescription('');
    setManifestJson('{}');
    setIsEnabled(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    let manifest: Record<string, unknown> = {};
    try {
      manifest = JSON.parse(manifestJson) as Record<string, unknown>;
    } catch {
      setError('Manifest is not valid JSON.');
      return;
    }
    setBusy(true);
    try {
      await extensionsApi.create({
        extensionKey,
        name,
        description: description.trim() === '' ? null : description,
        version,
        manifest,
        isEnabled,
      });
      setNotice('Extension registered.');
      resetForm();
      setShowForm(false);
      extensions.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [extensionKey, name, version, description, manifestJson, isEnabled, extensions]);

  const remove = useCallback((extension: ExtensionSummary) => {
    setConfirming(extension);
    setConfirmError(undefined);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (confirming === null) {
      return;
    }
    setConfirmPending(true);
    setConfirmError(undefined);
    try {
      await extensionsApi.remove(confirming.id);
      toast({
        title: 'Extension deleted',
        description: `Deleted “${confirming.name}”.`,
        variant: 'success',
      });
      setConfirming(null);
      extensions.reload();
    } catch (cause) {
      setConfirmError(messageOf(cause));
    } finally {
      setConfirmPending(false);
    }
  }, [confirming, extensions, toast]);

  const toggle = useCallback(
    async (extension: ExtensionSummary) => {
      setError(undefined);
      try {
        await extensionsApi.toggle(extension.id, !extension.isEnabled);
        extensions.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [extensions],
  );

  const rows = extensions.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Extension Registry"
        description="Third-party and customer extensions registered on the platform."
      />

      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>New extension</CardTitle>
                <CardDescription>Register an extension with its manifest.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New extension'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="extension-key">Extension key</Label>
                  <Input
                    id="extension-key"
                    value={extensionKey}
                    onChange={(e) => setExtensionKey(e.target.value)}
                    placeholder="e.g. hr-payroll-sync"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="extension-name">Name</Label>
                  <Input
                    id="extension-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="extension-version">Version</Label>
                  <Input
                    id="extension-version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extension-description">Description</Label>
                <Input
                  id="extension-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extension-manifest">Manifest (JSON)</Label>
                <Textarea
                  id="extension-manifest"
                  value={manifestJson}
                  onChange={(e) => setManifestJson(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={
                    busy ||
                    extensionKey.trim() === '' ||
                    name.trim() === '' ||
                    version.trim() === ''
                  }
                >
                  {busy ? 'Creating…' : 'Register'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildExtensionColumns({ canManage, onToggle: toggle, onRemove: remove })}
        filters={EXTENSION_FILTERS}
        searchable
        searchText={(extension) =>
          `${extension.extensionKey} ${extension.name} ${extension.version}`
        }
        searchPlaceholder="Search by key, name or version…"
        selectable={false}
        views={{ builtIn: EXTENSION_BUILT_IN_VIEWS, storageKey: EXTENSION_VIEWS_STORAGE_KEY }}
        status={extensions.loading ? 'loading' : extensions.error !== undefined ? 'error' : 'ready'}
        errorCopy={extensions.error}
        onRetry={() => extensions.reload()}
        emptyTitle="No extensions yet"
        emptyDescription="Register the first extension to extend the platform with custom behaviour."
        noResultsTitle="No extensions match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every extension."
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
            setConfirmError(undefined);
          }
        }}
        title={confirming !== null ? `Delete “${confirming.name}”?` : 'Delete extension?'}
        description={
          confirming !== null ? (
            <>
              The extension is removed from the registry and can no longer be enabled. Data it
              already wrote stays where it is; only the registration is deleted.
            </>
          ) : (
            'The extension is removed from the registry.'
          )
        }
        confirmLabel="Delete"
        tone="destructive"
        pending={confirmPending}
        error={confirmError}
        onConfirm={() => void confirmRemove()}
      />
    </PageBody>
  );
}
