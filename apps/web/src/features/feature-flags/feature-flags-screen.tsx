'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontalIcon, Trash2 } from 'lucide-react';

import type { FeatureFlagSummary } from '@hris/shared-types';

import {
  HrisDataTable,
  EMPTY_FILTERS,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { featureFlagsApi } from '@/features/feature-flags/feature-flags-api';
import { ApiRequestError } from '@/lib/api/http-client';

const FLAG_VIEWS_STORAGE_KEY = 'hris:feature-flags:views';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

const FLAG_SEARCH_TEXT = (flag: FeatureFlagSummary): string =>
  `${flag.key} ${flag.name} ${flag.description ?? ''}`;

const FLAG_FILTERS: readonly DataTableFilter<FeatureFlagSummary>[] = [
  {
    kind: 'select',
    id: 'state',
    label: 'State',
    placeholder: 'All states',
    getValue: (flag) => (flag.enabled ? 'ENABLED' : 'DISABLED'),
    options: [
      { value: 'ENABLED', label: 'Enabled' },
      { value: 'DISABLED', label: 'Disabled' },
    ],
  },
];

const FLAG_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All flags',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  {
    id: 'enabled',
    name: 'Enabled',
    builtIn: true,
    state: { filters: { ...EMPTY_FILTERS, select: { state: 'ENABLED' } }, search: '' },
  },
  {
    id: 'disabled',
    name: 'Disabled',
    builtIn: true,
    state: { filters: { ...EMPTY_FILTERS, select: { state: 'DISABLED' } }, search: '' },
  },
];

function buildFlagColumns({
  canManage,
  onToggle,
  onDelete,
}: {
  readonly canManage: boolean;
  readonly onToggle: (flag: FeatureFlagSummary) => void;
  readonly onDelete: (flag: FeatureFlagSummary) => void;
}): readonly DataTableColumn<FeatureFlagSummary>[] {
  const columns: DataTableColumn<FeatureFlagSummary>[] = [
    {
      id: 'key',
      header: 'Key',
      sortValue: (flag) => flag.key,
      cellClassName: 'font-mono text-sm',
      cell: (flag) => flag.key,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (flag) => flag.name,
      cellClassName: 'font-medium',
      cell: (flag) => flag.name,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (flag) => (flag.enabled ? 'ENABLED' : 'DISABLED'),
      cell: (flag) => (
        <Badge variant={flag.enabled ? 'success' : 'secondary'}>
          {flag.enabled ? 'ENABLED' : 'DISABLED'}
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
      cell: (flag) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Actions for ${flag.name}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <MoreHorizontalIcon aria-hidden="true" className="size-4" />
              </button>
            }
          >
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onToggle(flag)}>
                {flag.enabled ? 'Disable' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(flag)}>
                <Trash2 aria-hidden="true" className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuTrigger>
        </DropdownMenu>
      ),
    });
  }

  return columns;
}

export function FeatureFlagsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const flags = useIamLoad<readonly FeatureFlagSummary[]>(() => featureFlagsApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [rolloutText, setRolloutText] = useState('{}');

  const [confirmingDelete, setConfirmingDelete] = useState<FeatureFlagSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const resetForm = () => {
    setKey('');
    setName('');
    setDescription('');
    setEnabled(false);
    setRolloutText('{}');
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    let rollout: Record<string, unknown> = {};
    try {
      rollout = JSON.parse(rolloutText) as Record<string, unknown>;
    } catch {
      setError('Rollout is not valid JSON.');
      return;
    }
    setBusy(true);
    try {
      await featureFlagsApi.create({
        key,
        name,
        description: description.trim() === '' ? null : description,
        enabled,
        rollout,
      });
      setNotice('Flag created.');
      resetForm();
      setShowForm(false);
      flags.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [key, name, description, enabled, rolloutText, flags]);

  const toggle = useCallback(
    async (flag: FeatureFlagSummary) => {
      setError(undefined);
      try {
        await featureFlagsApi.toggle(flag.id, !flag.enabled);
        flags.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [flags],
  );

  const requestDelete = useCallback((flag: FeatureFlagSummary) => {
    setDeleteError(undefined);
    setConfirmingDelete(flag);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (confirmingDelete === null) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await featureFlagsApi.remove(confirmingDelete.id);
      toast({
        title: 'Flag deleted',
        description: `Deleted "${confirmingDelete.name}".`,
        variant: 'success',
      });
      setConfirmingDelete(null);
      flags.reload();
    } catch (cause) {
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  }, [confirmingDelete, flags, toast]);

  const rows = flags.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Feature Flags"
        description="Tenant-scoped flags that gate functionality."
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
                <CardTitle>New flag</CardTitle>
                <CardDescription>Feature flags are tenant-scoped.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New flag'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="flag-key">Key</Label>
                  <Input id="flag-key" value={key} onChange={(e) => setKey(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="flag-name">Name</Label>
                  <Input id="flag-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="flag-description">Description</Label>
                <Input
                  id="flag-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="flag-rollout">Rollout (JSON)</Label>
                <Textarea
                  id="flag-rollout"
                  value={rolloutText}
                  onChange={(e) => setRolloutText(e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setEnabled(!enabled)}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={busy || key.trim() === '' || name.trim() === ''}
                >
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildFlagColumns({
          canManage,
          onToggle: toggle,
          onDelete: requestDelete,
        })}
        filters={FLAG_FILTERS}
        searchable
        searchText={FLAG_SEARCH_TEXT}
        searchPlaceholder="Search by key, name or description…"
        selectable={false}
        views={{ builtIn: FLAG_BUILT_IN_VIEWS, storageKey: FLAG_VIEWS_STORAGE_KEY }}
        status={flags.loading ? 'loading' : flags.error !== undefined ? 'error' : 'ready'}
        errorCopy={flags.error}
        onRetry={() => flags.reload()}
        emptyTitle="No flags yet"
        emptyDescription="Feature flags created here appear in this list."
        noResultsTitle="No flags match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every flag."
      />

      <ConfirmDialog
        open={confirmingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingDelete(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete "${confirmingDelete?.name ?? ''}"?`}
        description="This flag is removed from the tenant. Any code that depends on it will fall back to its default behaviour."
        confirmLabel="Delete"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
