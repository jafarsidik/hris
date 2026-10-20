'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { tenantSettingsApi } from '@/features/platform/tenant-settings-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { SystemSettingReadModel } from '@hris/shared-types';

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

type SettingRow = SystemSettingReadModel & { readonly id: string };

interface EditState {
  editing: boolean;
  value: string;
}

const SETTINGS_VIEWS_STORAGE_KEY = 'hris:tenant-settings:views';

function buildSettingFilters(rows: readonly SettingRow[]): readonly DataTableFilter<SettingRow>[] {
  const groups = [...new Set(rows.map((row) => row.group))]
    .sort((a, b) => a.localeCompare(b))
    .map((group) => ({ value: group, label: group }));

  return [
    {
      kind: 'select',
      id: 'group',
      label: 'Group',
      placeholder: 'All groups',
      getValue: (row) => row.group,
      options: groups,
    },
  ];
}

const SETTINGS_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All settings',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

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

  const rows: SettingRow[] = (settings.data ?? []).map((row) => ({
    ...row,
    id: `${row.group}:${row.key}`,
  }));

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

  const columns: DataTableColumn<SettingRow>[] = [
    {
      id: 'key',
      header: 'Key',
      sortValue: (row) => row.key,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.key,
    },
    {
      id: 'type',
      header: 'Type',
      sortValue: (row) => row.valueType,
      cellClassName: 'text-muted-foreground text-sm',
      cell: (row) => row.valueType,
    },
    {
      id: 'value',
      header: 'Value',
      sortValue: (row) => row.value ?? '',
      cellClassName: 'max-w-[18rem] font-mono text-sm',
      cell: (row) => {
        const st = editStates[row.id];
        if (st?.editing && canManage) {
          return (
            <Input
              id={`edit-${row.id}`}
              value={st.value}
              onChange={(e) => setEditValue(row.id, e.currentTarget.value)}
              className="h-8"
            />
          );
        }
        return (
          <span className="block truncate" title={row.value ?? undefined}>
            {mask(row.value, row.isSensitive)}
          </span>
        );
      },
    },
    {
      id: 'sensitive',
      header: 'Sensitive',
      sortValue: (row) => (row.isSensitive ? 'yes' : 'no'),
      align: 'right',
      cellClassName: 'font-mono text-xs',
      cell: (row) => (row.isSensitive ? 'yes' : 'no'),
    },
  ];

  if (canManage) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => {
        const st = editStates[row.id];
        if (st?.editing) {
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => saveEdit(row.id)}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => cancelEdit(row.id)}>
                Cancel
              </Button>
            </div>
          );
        }
        return (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => startEdit(row.id, row.value)}>
              Edit
            </Button>
          </div>
        );
      },
    });
  }

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

      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={buildSettingFilters(rows)}
        searchable
        searchText={(row) => `${row.key} ${row.valueType} ${row.group}`}
        searchPlaceholder="Search by key, type or group…"
        selectable={false}
        views={{ builtIn: SETTINGS_BUILT_IN_VIEWS, storageKey: SETTINGS_VIEWS_STORAGE_KEY }}
        status={
          settings.loading && rows.length === 0
            ? 'loading'
            : settings.error !== undefined
              ? 'error'
              : 'ready'
        }
        errorCopy={settings.error}
        onRetry={() => settings.reload()}
        emptyTitle="No settings configured"
        emptyDescription="Settings appear here once the tenant has configured them."
        noResultsTitle="No settings match this filter"
        noResultsDescription="Try a different search or clear the filters to see every setting."
      />

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
    </PageBody>
  );
}
