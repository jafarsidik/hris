'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { userGroupsApi } from '@/features/governance/governance-api';
import {
  USER_GROUP_BUILT_IN_VIEWS,
  USER_GROUP_SEARCH_TEXT,
  USER_GROUP_VIEWS_STORAGE_KEY,
  buildUserGroupColumns,
} from '@/features/governance/user-groups-table-config';
import { ApiRequestError } from '@/lib/api/http-client';
import type { UserGroupSummary } from '@hris/shared-types';

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

  const [deleting, setDeleting] = useState<UserGroupSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

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

  const confirmDelete = useCallback(async () => {
    if (deleting === null) {
      return;
    }
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await userGroupsApi.remove(deleting.id);
      setNotice(`Deleted "${deleting.name}".`);
      setDeleting(null);
      groups.reload();
    } catch (cause) {
      setDeleteError(messageOf(cause));
    } finally {
      setDeletePending(false);
    }
  }, [deleting, groups]);

  const rows = (groups.data ?? []) as UserGroupSummary[];

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

      <HrisDataTable
        rows={rows}
        columns={buildUserGroupColumns({ onDelete: (group) => setDeleting(group) })}
        searchable
        searchText={USER_GROUP_SEARCH_TEXT}
        searchPlaceholder="Search by name or description…"
        selectable={false}
        views={{
          builtIn: USER_GROUP_BUILT_IN_VIEWS,
          storageKey: USER_GROUP_VIEWS_STORAGE_KEY,
        }}
        status={groups.loading ? 'loading' : groups.error !== undefined ? 'error' : 'ready'}
        errorCopy={groups.error}
        onRetry={() => groups.reload()}
        emptyTitle="No groups yet"
        emptyDescription="Create a user group to assign access collectively."
        noResultsTitle="No groups match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every group."
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description="The group is removed and users who held it lose any access granted through it. Their accounts and direct permissions are untouched. This cannot be undone."
        confirmLabel="Delete group"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
