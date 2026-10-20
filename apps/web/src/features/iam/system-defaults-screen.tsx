'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import {
  HrisDataTable,
  EMPTY_FILTERS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useCan, useSession } from '@/features/auth/session-context';

import { getIam } from '@/features/iam';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { SYSTEM_SETTING_DEFAULTS } from '@hris/shared-types';

interface DefaultRow {
  /** The setting key doubles as the row id: it is unique across the catalogue. */
  readonly id: string;
  readonly group: string;
  readonly key: string;
  readonly valueType: string;
  readonly default: string;
  readonly current: string | null;
  readonly status: 'default' | 'changed' | 'unset';
}

const STATUS_LABEL: Record<DefaultRow['status'], string> = {
  default: 'Default',
  changed: 'Customized',
  unset: 'Not set',
};

const STATUS_VARIANT: Record<DefaultRow['status'], 'success' | 'warning' | 'secondary'> = {
  default: 'success',
  changed: 'warning',
  unset: 'secondary',
};

const STATUS_FILTER = [
  { value: 'changed', label: 'Customized' },
  { value: 'default', label: 'Default' },
  { value: 'unset', label: 'Not set' },
];

const withStatus = (status: DefaultRow['status']) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/**
 * The columns, filters and views of the catalogue table.
 *
 * Declared here rather than in a `*-table-config.tsx` module because this table has one
 * consumer and no other page reads `DefaultRow`.
 */
const SETTING_COLUMNS: readonly DataTableColumn<DefaultRow>[] = [
  {
    id: 'group',
    header: 'Group',
    sortValue: (row) => row.group,
    cellClassName: 'text-sm text-muted-foreground',
    cell: (row) => row.group,
  },
  {
    id: 'key',
    header: 'Key',
    sortValue: (row) => row.key,
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.key,
  },
  {
    id: 'valueType',
    header: 'Type',
    sortValue: (row) => row.valueType,
    responsive: 'hidden md:table-cell',
    align: 'center',
    cellClassName: 'text-sm text-muted-foreground',
    cell: (row) => row.valueType,
  },
  {
    id: 'default',
    header: 'Default',
    sortValue: (row) => row.default,
    responsive: 'hidden lg:table-cell',
    cellClassName: 'max-w-[18rem] text-sm text-muted-foreground',
    cell: (row) => (
      <span className="block truncate" title={row.default}>
        {row.default}
      </span>
    ),
  },
  {
    id: 'current',
    header: 'Current value',
    sortValue: (row) => row.current ?? '',
    align: 'right',
    cellClassName: 'max-w-[18rem] font-mono text-sm',
    cell: (row) => (
      <span className="block truncate" title={row.current ?? undefined}>
        {row.current ?? '—'}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    sortValue: (row) => row.status,
    align: 'center',
    cell: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
  },
];

const SETTING_FILTERS: readonly DataTableFilter<DefaultRow>[] = [
  {
    kind: 'select',
    id: 'status',
    label: 'Status',
    placeholder: 'All statuses',
    getValue: (row) => row.status,
    options: STATUS_FILTER,
  },
  {
    kind: 'select',
    id: 'group',
    label: 'Group',
    placeholder: 'All groups',
    getValue: (row) => row.group,
    advanced: true,
    options: [...new Set(SYSTEM_SETTING_DEFAULTS.map((def) => def.group))]
      .sort((left, right) => left.localeCompare(right))
      .map((group) => ({ value: group, label: group })),
  },
];

const SETTING_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All settings',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'customized', name: 'Customized', builtIn: true, state: withStatus('changed') },
  { id: 'not-set', name: 'Not set', builtIn: true, state: withStatus('unset') },
];

const SETTING_VIEWS_STORAGE_KEY = 'hris:system-defaults:views';

/**
 * System Defaults: the platform-wide setting catalogue — what each setting defaults
 * to, what this company has set, and where the tenant has drifted from the default.
 */
export function SystemDefaultsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canView = useCan('setting.view');

  const settings = useIamLoad(() => getIam().listSettings(), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const current = new Map((settings.data ?? []).map((row) => [row.key, row.value ?? null]));

  const rows: DefaultRow[] = [];
  for (const def of SYSTEM_SETTING_DEFAULTS) {
    const value = current.get(def.key) ?? null;
    let status: DefaultRow['status'] = 'default';
    if (value === null) status = 'unset';
    else if (String(value) !== String(def.value)) status = 'changed';
    rows.push({
      id: def.key,
      group: def.group,
      key: def.key,
      valueType: def.valueType,
      default: mask(def.valueType, def.value),
      current: value === null ? null : mask(def.valueType, value),
      status,
    });
  }
  rows.sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key));

  const changed = rows.filter((row) => row.status === 'changed').length;

  return (
    <PageBody>
      <PageHeader
        title="System Defaults"
        description="Company and platform default values — defaults versus what this company has set."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={settings.loading}
            onClick={() => settings.reload()}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Card>
            <CardHeader className="pb-1.5">
              <CardDescription>Settings in catalogue</CardDescription>
              <CardTitle className="text-xl tabular-nums">{String(rows.length)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1.5">
              <CardDescription>Customized from default</CardDescription>
              <CardTitle className="text-xl tabular-nums">{String(changed)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/*
          The catalogue used to be a bare `<table>` inside a `Card`, with no search, no sort
          and no way to hide a column — while every other list in the console had all three.
          It now uses the shared table; the outer card went with it, because the shared table
          brings its own, and a card inside a card is two frames around one list.
        */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Setting catalogue</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} system setting{rows.length === 1 ? '' : 's'}
            {changed > 0 ? ` · ${changed} customized` : ''}
          </p>
        </div>

        <HrisDataTable
          rows={rows}
          columns={SETTING_COLUMNS}
          filters={SETTING_FILTERS}
          searchable
          searchText={(row) => `${row.group} ${row.key} ${row.valueType} ${row.default}`}
          searchPlaceholder="Search by group, key or default…"
          selectable={false}
          views={{ builtIn: SETTING_VIEWS, storageKey: SETTING_VIEWS_STORAGE_KEY }}
          status={settings.loading ? 'loading' : settings.error !== undefined ? 'error' : 'ready'}
          errorCopy={settings.error}
          onRetry={() => settings.reload()}
          emptyTitle="No settings defined"
          emptyDescription="Settings appear here once the catalogue registers them."
          noResultsTitle="No setting matches this filter"
          noResultsDescription="Try a different search, status or group."
        />

        {!canView && (
          <Alert>
            <AlertTitle>Read-only view</AlertTitle>
            <AlertDescription>
              You don't have permission to read system settings; contact your administrator.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </PageBody>
  );
}

function mask(valueType: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (valueType === 'BOOLEAN') {
    return String(value);
  }
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
