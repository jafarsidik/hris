'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
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

  return (
    <PageBody>
      <PageHeader
        title="Backup & Restore"
        description="Automated backup schedule and restore entry point."
      />

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
                <SelectTrigger className="w-40">
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

      <Card>
        <CardHeader>
          <CardTitle>Restore points</CardTitle>
          <CardDescription>
            Restore operations are infra-led; use this surface to record and review them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started at</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">
                    {config.data?.lastRunAt ?? 'No restore points'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">Full tenant</TableCell>
                  <TableCell>
                    <Badge variant={config.data?.lastRunAt ? 'success' : 'secondary'}>
                      {config.data?.lastRunAt ? 'Completed' : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" disabled>
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Actual backup creation and restore are handled by platform infrastructure; this screen
            manages the schedule and records the outcome.
          </p>
        </CardContent>
      </Card>
    </PageBody>
  );
}
