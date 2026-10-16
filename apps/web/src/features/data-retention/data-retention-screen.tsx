'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { DataRetentionScheduleSummary } from '@hris/shared-types';

import { Trash2 } from 'lucide-react';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { dataRetentionApi } from '@/features/data-retention/data-retention-api';
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

export function DataRetentionScreen() {
  const router = useRouter();
  const { state } = useSession();
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

  const remove = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete retention schedule for “${name}"?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await dataRetentionApi.remove(id);
        setNotice(`Deleted schedule for “${name}".`);
        schedules.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [schedules],
  );

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

  const rows = schedules.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Data Retention"
        description="Retention and purge schedules per data class."
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

      <Card>
        <CardHeader>
          <CardTitle>Schedules</CardTitle>
          <CardDescription>
            {schedules.loading
              ? 'Loading…'
              : `${rows.length} schedule${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{schedules.error}</AlertDescription>
            </Alert>
          )}
          {schedules.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schedules yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Purge after</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.resource}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {schedule.retentionDays} days
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {schedule.purgeAfterDays} days
                    </TableCell>
                    <TableCell>
                      <Badge variant={schedule.isEnabled ? 'success' : 'secondary'}>
                        {schedule.isEnabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void toggle(schedule)}>
                            {schedule.isEnabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(schedule.id, schedule.resource)}
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
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
