'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontalIcon, Trash2 } from 'lucide-react';

import type { DataRetentionScheduleSummary } from '@hris/shared-types';

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
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { dataRetentionApi } from '@/features/data-retention/data-retention-api';
import { ApiRequestError } from '@/lib/api/http-client';

const RETENTION_VIEWS_STORAGE_KEY = 'hris:data-retention:views';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

const RETENTION_SEARCH_TEXT = (schedule: DataRetentionScheduleSummary): string => schedule.resource;

const RETENTION_FILTERS: readonly DataTableFilter<DataRetentionScheduleSummary>[] = [
  {
    kind: 'select',
    id: 'state',
    label: 'State',
    placeholder: 'All states',
    getValue: (schedule) => (schedule.isEnabled ? 'ENABLED' : 'DISABLED'),
    options: [
      { value: 'ENABLED', label: 'Enabled' },
      { value: 'DISABLED', label: 'Disabled' },
    ],
  },
];

const RETENTION_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All schedules',
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

function buildRetentionColumns({
  canManage,
  onToggle,
  onDelete,
}: {
  readonly canManage: boolean;
  readonly onToggle: (schedule: DataRetentionScheduleSummary) => void;
  readonly onDelete: (schedule: DataRetentionScheduleSummary) => void;
}): readonly DataTableColumn<DataRetentionScheduleSummary>[] {
  const columns: DataTableColumn<DataRetentionScheduleSummary>[] = [
    {
      id: 'resource',
      header: 'Resource',
      sortValue: (schedule) => schedule.resource,
      cellClassName: 'font-medium',
      cell: (schedule) => schedule.resource,
    },
    {
      id: 'retention',
      header: 'Retention',
      sortValue: (schedule) => schedule.retentionDays,
      cellClassName: 'font-mono text-sm',
      cell: (schedule) => `${schedule.retentionDays} days`,
    },
    {
      id: 'purgeAfter',
      header: 'Purge after',
      sortValue: (schedule) => schedule.purgeAfterDays,
      cellClassName: 'font-mono text-sm',
      cell: (schedule) => `${schedule.purgeAfterDays} days`,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (schedule) => (schedule.isEnabled ? 'ENABLED' : 'DISABLED'),
      cell: (schedule) => (
        <Badge variant={schedule.isEnabled ? 'success' : 'secondary'}>
          {schedule.isEnabled ? 'ENABLED' : 'DISABLED'}
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
      cell: (schedule) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Actions for ${schedule.resource}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <MoreHorizontalIcon aria-hidden="true" className="size-4" />
              </button>
            }
          >
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onToggle(schedule)}>
                {schedule.isEnabled ? 'Disable' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(schedule)}>
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

export function DataRetentionScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const schedules = useIamLoad(() => dataRetentionApi.list(), []);
  const canManage = useCan('document.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [resource, setResource] = useState('');
  const [retentionDays, setRetentionDays] = useState(30);
  const [purgeAfterDays, setPurgeAfterDays] = useState(30);
  const [isEnabled, setIsEnabled] = useState(true);

  const [confirmingDelete, setConfirmingDelete] = useState<DataRetentionScheduleSummary | null>(
    null,
  );
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const resetForm = () => {
    setResource('');
    setRetentionDays(30);
    setPurgeAfterDays(30);
    setIsEnabled(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await dataRetentionApi.create({
        resource,
        retentionDays,
        purgeAfterDays,
        isEnabled,
      });
      setNotice('Retention schedule created.');
      resetForm();
      setShowForm(false);
      schedules.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [resource, retentionDays, purgeAfterDays, isEnabled, schedules]);

  const toggle = useCallback(
    async (schedule: DataRetentionScheduleSummary) => {
      setError(undefined);
      try {
        await dataRetentionApi.toggle(schedule.id, !schedule.isEnabled);
        schedules.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [schedules],
  );

  const requestDelete = useCallback((schedule: DataRetentionScheduleSummary) => {
    setDeleteError(undefined);
    setConfirmingDelete(schedule);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (confirmingDelete === null) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await dataRetentionApi.remove(confirmingDelete.id);
      toast({
        title: 'Schedule deleted',
        description: `Deleted schedule for "${confirmingDelete.resource}".`,
        variant: 'success',
      });
      setConfirmingDelete(null);
      schedules.reload();
    } catch (cause) {
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  }, [confirmingDelete, schedules, toast]);

  const rows = schedules.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Data Retention"
        description="Retention and purge schedules per data class."
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
                <CardTitle>New schedule</CardTitle>
                <CardDescription>
                  Set how long a data class is retained before purge.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New schedule'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="retention-resource">Resource</Label>
                  <Input
                    id="retention-resource"
                    value={resource}
                    onChange={(e) => setResource(e.target.value)}
                    placeholder="e.g. audit_logs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="retention-days">Retention (days)</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="retention-purge">Purge after (days)</Label>
                  <Input
                    id="retention-purge"
                    type="number"
                    value={purgeAfterDays}
                    onChange={(e) => setPurgeAfterDays(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void submit()} disabled={busy || resource.trim() === ''}>
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildRetentionColumns({
          canManage,
          onToggle: toggle,
          onDelete: requestDelete,
        })}
        filters={RETENTION_FILTERS}
        searchable
        searchText={RETENTION_SEARCH_TEXT}
        searchPlaceholder="Search by resource…"
        selectable={false}
        views={{ builtIn: RETENTION_BUILT_IN_VIEWS, storageKey: RETENTION_VIEWS_STORAGE_KEY }}
        status={schedules.loading ? 'loading' : schedules.error !== undefined ? 'error' : 'ready'}
        errorCopy={schedules.error}
        onRetry={() => schedules.reload()}
        emptyTitle="No schedules yet"
        emptyDescription="Retention schedules created here appear in this list."
        noResultsTitle="No schedules match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every schedule."
      />

      <ConfirmDialog
        open={confirmingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingDelete(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete retention schedule for "${confirmingDelete?.resource ?? ''}"?`}
        description="This schedule is removed. Data classes without a schedule fall back to the platform default retention policy."
        confirmLabel="Delete"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
