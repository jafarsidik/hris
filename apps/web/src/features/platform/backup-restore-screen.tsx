'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { backupRestoreApi, type BackupConfig } from '@/features/platform/backup-restore-api';
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

const SCHEDULES = ['off', 'daily', 'weekly', 'monthly'] as const;

/**
 * One recorded restore point.
 *
 * The screen stores a single latest run rather than a history, so the row is computed
 * from the config and the list holds at most one entry. `lastRunAt` doubles as the id:
 * it is the restore point's identity and it is unique because there is only one.
 */
interface RestorePointRow {
  readonly id: string;
  readonly startedAt: string;
  readonly type: string;
  readonly status: string;
}

const RESTORE_POINT_COLUMNS: readonly DataTableColumn<RestorePointRow>[] = [
  {
    id: 'startedAt',
    header: 'Started at',
    sortValue: (row) => row.startedAt,
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.startedAt,
  },
  {
    id: 'type',
    header: 'Type',
    sortValue: (row) => row.type,
    cellClassName: 'text-muted-foreground',
    cell: (row) => row.type,
  },
  {
    id: 'status',
    header: 'Status',
    sortValue: (row) => row.status,
    cell: (row) => <Badge variant="success">{row.status}</Badge>,
  },
];

export function BackupRestoreScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canManage = useCan('setting.update');

  const config = useIamLoad(() => backupRestoreApi.getConfig(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  // Edit draft
  const [draft, setDraft] = useState<BackupConfig>({
    schedule: 'daily',
    retentionDays: 30,
    lastRunAt: null,
  });

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    if (config.data) {
      setDraft({
        schedule: config.data.schedule,
        retentionDays: config.data.retentionDays,
        lastRunAt: config.data.lastRunAt,
      });
    }
  }, [config.data]);

  const save = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await backupRestoreApi.saveConfig(draft);
      setNotice('Backup configuration saved.');
      config.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [draft, config]);

  const triggerBackup = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await backupRestoreApi.triggerBackup();
      setNotice('Backup triggered.');
      config.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [config]);

  const lastRunAt = config.data?.lastRunAt ?? null;
  const restorePoints: readonly RestorePointRow[] =
    lastRunAt === null
      ? []
      : [{ id: lastRunAt, startedAt: lastRunAt, type: 'Full tenant', status: 'Completed' }];

  return (
    <PageBody>
      <PageHeader
        title="Backup & Restore"
        description="Automated backup schedule and restore entry point."
      />

      {error !== undefined && <ErrorPanel error={error} onRetry={() => config.reload()} />}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Backup schedule and retention are stored as company settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-schedule">Schedule</Label>
              <Select
                value={draft.schedule}
                onValueChange={(v) => setDraft({ ...draft, schedule: v ?? draft.schedule })}
                disabled={!canManage || busy}
              >
                <SelectTrigger className="w-40" aria-label="Backup schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'off' ? 'Disabled' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-retention">Retain backups (days)</Label>
              <Input
                id="backup-retention"
                type="number"
                value={draft.retentionDays}
                onChange={(e) => setDraft({ ...draft, retentionDays: Number(e.target.value) })}
                disabled={!canManage || busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-lastrun">Last run</Label>
              <p className="font-mono text-sm">{config.data?.lastRunAt ?? 'Never'}</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !canManage}
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : 'Save configuration'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !canManage}
              onClick={() => void triggerBackup()}
            >
              <RefreshCw className="mr-1 size-4" aria-hidden />
              {busy ? 'Running…' : 'Run backup now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/*
        The restore points list used to be a one-row `<table>` inside its own card with
        a skeleton and an empty state, duplicating what the shared table owns. It now
        renders through the shared table; the outer card went with it because the
        table brings its own. Search is switched off: the list holds at most one row,
        so a search box would be a control that can only ever match or not match a
        single record.
      */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Restore points</h2>
        <p className="text-sm text-muted-foreground">
          Restore operations are infra-led; use this surface to record and review them.
        </p>
      </div>
      <HrisDataTable
        rows={restorePoints}
        columns={RESTORE_POINT_COLUMNS}
        searchable={false}
        selectable={false}
        status={config.loading ? 'loading' : config.error !== undefined ? 'error' : 'ready'}
        errorCopy={config.error}
        onRetry={() => config.reload()}
        emptyTitle="No restore points recorded yet"
        emptyDescription="Run a backup to create the first restore point."
      />

      <p className="text-xs text-muted-foreground">
        Actual backup creation and restore are handled by platform infrastructure; this screen
        manages the schedule and records the outcome.
      </p>
    </PageBody>
  );
}
