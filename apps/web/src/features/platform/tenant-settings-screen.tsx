'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { SystemSettingReadModel } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { tenantSettingsApi } from '@/features/platform/tenant-settings-api';
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

function mask(value: string | null, isSensitive: boolean): string {
  if (value === null) {
    return '—';
  }
  if (isSensitive) {
    return '••••••••';
  }
  return String(value);
}

interface EditState {
  editing: boolean;
  value: string;
}

export function TenantSettingsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const settings = useIamLoad(() => tenantSettingsApi.list(), []);
  const canManage = useCan('setting.update');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});

  const rows = (settings.data ?? []) as SystemSettingReadModel[];
  const byGroup = new Map<string, SystemSettingReadModel[]>();
  for (const row of rows) {
    const bucket = byGroup.get(row.group) ?? [];
    bucket.push(row);
    byGroup.set(row.group, bucket);
  }

  const editsOf = (states: Record<string, EditState>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, st] of Object.entries(states)) {
      if (st.editing) {
        out[key] = st.value;
      }
    }
    return out;
  };

  const save = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    const items = Object.entries(editsOf(editStates)).map(([key, value]) => ({ key, value }));
    if (items.length === 0) {
      return;
    }
    setBusy(true);
    try {
      await tenantSettingsApi.update(items);
      setNotice('Settings saved.');
      setEditStates({});
      settings.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [editStates, settings]);

  const startEdit = (rowKey: string, value: string | null) => {
    setEditStates((prev) => ({
      ...prev,
      [rowKey]: { editing: true, value: value === null ? '' : String(value) },
    }));
  };

  const setEditValue = (rowKey: string, value: string) => {
    setEditStates((prev) => ({
      ...prev,
      [rowKey]: { ...(prev[rowKey] ?? { editing: false, value: '' }), value },
    }));
  };

  const saveEdit = (rowKey: string) => {
    setEditStates((prev) => {
      const next = { ...prev };
      if (next[rowKey]) {
        next[rowKey] = { ...next[rowKey], editing: false };
      }
      return next;
    });
  };

  const cancelEdit = (rowKey: string) => {
    setEditStates((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Tenant Settings"
        description="Company-scoped system settings. Sensitive values are masked on read."
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

      {settings.loading && rows.length === 0 ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No settings configured" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              {rows.length} setting{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {[...byGroup.entries()].map(([group, groupRows]) => (
              <div key={group} className="mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="text-right">Sensitive</TableHead>
                      {canManage && <TableHead className="text-right">Edit</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupRows.map((row) => {
                      const rowKey = `${row.group}:${row.key}`;
                      const st = editStates[rowKey] ?? { editing: false, value: '' };
                      return (
                        <TableRow key={rowKey}>
                          <TableCell className="font-mono text-sm">{row.key}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.valueType}
                          </TableCell>
                          <TableCell>
                            {st.editing && canManage ? (
                              <Input
                                id={`edit-${rowKey}`}
                                value={st.value}
                                onChange={(e) => setEditValue(rowKey, e.currentTarget.value)}
                              />
                            ) : (
                              mask(row.value, row.isSensitive)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.isSensitive ? 'yes' : 'no'}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              {!st.editing ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEdit(rowKey, row.value)}
                                >
                                  Edit
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => saveEdit(rowKey)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelEdit(rowKey)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
            {canManage && (
              <div className="mt-4 flex justify-end">
                <Button
                  disabled={busy || Object.keys(editsOf(editStates)).length === 0}
                  onClick={() => void save()}
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
