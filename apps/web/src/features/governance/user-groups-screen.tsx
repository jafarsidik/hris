'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { userGroupsApi } from '@/features/governance/governance-api';
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

export function UserGroupsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const groups = useIamLoad(() => userGroupsApi.list(), []);
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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await userGroupsApi.create({
        name,
        description: description.trim() === '' ? null : description,
      });
      setNotice('User group created.');
      resetForm();
      setShowForm(false);
      groups.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [name, description, groups]);

  const remove = useCallback(
    async (id: string, n: string) => {
      if (!window.confirm(`Delete “${n}”?`)) {
        return;
      }
      setError(undefined);
      setBusy(true);
      try {
        await userGroupsApi.remove(id);
        setNotice(`Deleted “${n}”.`);
        groups.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
    [groups],
  );

  const rows = (groups.data ?? []) as Array<{
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly memberCount: number;
  }>;

  return (
    <PageBody>
      <PageHeader
        title="User Groups"
        description="Group users so access can be assigned collectively."
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
                <CardTitle>New group</CardTitle>
                <CardDescription>Create a group you can add members to.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New group'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="group-name">Name</Label>
                  <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="group-description">Description</Label>
                  <Input
                    id="group-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void submit()} disabled={busy || name.trim() === ''}>
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Groups</CardTitle>
          <CardDescription>
            {groups.loading ? 'Loading…' : `${rows.length} group${rows.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.error !== undefined && (
            <Alert variant="destructive">
              <AlertDescription>{groups.error}</AlertDescription>
            </Alert>
          )}
          {groups.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(
                  (group: {
                    id: string;
                    name: string;
                    description: string | null;
                    memberCount: number;
                  }) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {group.description ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono">{group.memberCount}</TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void remove(group.id, group.name)}
                            >
                              <Trash2 className="mr-1 size-4" aria-hidden />
                              Delete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
