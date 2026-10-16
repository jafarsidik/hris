'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import type { FeatureFlagSummary } from '@hris/shared-types';

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
import { Textarea } from '@/components/ui/textarea';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { featureFlagsApi } from '@/features/feature-flags/feature-flags-api';
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

export function FeatureFlagsScreen() {
  const router = useRouter();
  const { state } = useSession();
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

  const remove = useCallback(
    async (id: string, nameValue: string) => {
      if (!window.confirm(`Delete "${nameValue}"?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await featureFlagsApi.remove(id);
        setNotice(`Deleted "${nameValue}".`);
        flags.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [flags],
  );

  const rows = flags.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Feature Flags"
        description="Tenant-scoped flags that gate functionality."
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

      <Card>
        <CardHeader>
          <CardTitle>Flags</CardTitle>
          <CardDescription>
            {flags.loading ? 'Loading…' : `${rows.length} flag${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flags.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{flags.error}</AlertDescription>
            </Alert>
          )}
          {flags.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-mono text-sm">{flag.key}</TableCell>
                    <TableCell className="font-medium">{flag.name}</TableCell>
                    <TableCell>
                      <Badge variant={flag.enabled ? 'success' : 'secondary'}>
                        {flag.enabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void toggle(flag)}>
                            {flag.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(flag.id, flag.name)}
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
