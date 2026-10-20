'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  EMPTY_FILTERS,
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ModuleForm } from '@/features/platform/modules-screen';
import { platformApi } from '@/features/platform/platform-api';

import type { ApplicationSummary, ModuleSummary } from '@hris/shared-types';

/**
 * A module row enriched with the owning application's display fields.
 *
 * The screen used to render one table per application under a section header that
 * carried the application's name, key and state badge. A single shared table cannot
 * keep that grouping without one toolbar per application, so the grouping moves into
 * an Application column: the same name, key and state badge, read off the row instead
 * of off a header. Modules whose application no longer resolves are skipped, exactly
 * as the per-application lookup skipped them before.
 */
interface ModuleRow extends ModuleSummary {
  readonly applicationName: string;
  readonly applicationKey: string;
  readonly applicationIsActive: boolean;
}

const STATE_FILTER = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const withState = (state: 'ACTIVE' | 'INACTIVE') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

const MODULE_VIEWS_STORAGE_KEY = 'hris:modules-entitlements:views';

const MODULE_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All modules',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'active', name: 'Active', builtIn: true, state: withState('ACTIVE') },
  { id: 'inactive', name: 'Inactive', builtIn: true, state: withState('INACTIVE') },
];

/**
 * The modules table's columns.
 *
 * The actions column is pinned because the table scrolls horizontally on narrower
 * windows; an Edit button that scrolls out of sight cannot be clicked. It is offered
 * only to a reader with `registry.manage`.
 */
function buildModuleColumns({
  canManage,
  onEdit,
}: {
  readonly canManage: boolean;
  readonly onEdit: (module: ModuleSummary) => void;
}): readonly DataTableColumn<ModuleRow>[] {
  const columns: DataTableColumn<ModuleRow>[] = [
    {
      id: 'application',
      header: 'Application',
      sortValue: (row) => row.applicationName,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.applicationName}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.applicationKey}</span>
          <Badge variant={row.applicationIsActive ? 'success' : 'secondary'} className="w-fit">
            {row.applicationIsActive ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        </div>
      ),
    },
    {
      id: 'key',
      header: 'Key',
      sortValue: (row) => row.key,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.key,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (row) => row.name,
      cellClassName: 'font-medium',
      cell: (row) => row.name,
    },
    {
      id: 'sortOrder',
      header: 'Sort order',
      sortValue: (row) => row.sortOrder,
      cellClassName: 'text-muted-foreground text-sm',
      cell: (row) => row.sortOrder,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'secondary'}>
          {row.isActive ? 'ACTIVE' : 'INACTIVE'}
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
      cell: (row) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
            Edit
          </Button>
        </div>
      ),
    });
  }

  return columns;
}

/**
 * Modules & Entitlements: the modules owned by each application — the functional
 * areas that register resources.
 *
 * The screen used to render one bespoke `<table>` per application inside a bordered
 * section, with a skeleton while loading and a one-line empty state. It now renders
 * through the shared table as a single list: the per-application grouping moved into
 * an Application column (see {@link ModuleRow}), and the table brings search, sorting,
 * pagination, column visibility and saved views. Filtering is client-side and honest
 * — both the applications and the modules are already in memory.
 */
export function ModulesEntitlementsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const applications = useIamLoad(() => platformApi.listRegistryApplications(), []);
  const modules = useIamLoad(() => platformApi.listRegistryModules(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const appRows = applications.data ?? [];
  const moduleRows = modules.data ?? [];
  const errorText = applications.error ?? modules.error;
  const [editing, setEditing] = useState<ModuleSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const appById = new Map(appRows.map((app: ApplicationSummary) => [app.id, app]));

  const rows: ModuleRow[] = [];
  for (const module of moduleRows) {
    const app = appById.get(module.applicationId);
    if (app === undefined) {
      continue;
    }
    rows.push({
      ...module,
      applicationName: app.name,
      applicationKey: app.key,
      applicationIsActive: app.isActive,
    });
  }

  const applicationOptions = appRows.map((app: ApplicationSummary) => ({
    value: app.id,
    label: app.name,
  }));

  const moduleFilters: readonly DataTableFilter<ModuleRow>[] = [
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
      options: STATE_FILTER,
    },
    {
      kind: 'select',
      id: 'application',
      label: 'Application',
      placeholder: 'All applications',
      getValue: (row) => row.applicationId,
      advanced: true,
      options: applicationOptions,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Modules & Entitlements"
        description="Modules owned by each application — the functional areas that register resources."
      />

      <HrisDataTable
        rows={rows}
        columns={buildModuleColumns({
          canManage,
          onEdit: (module) => {
            setEditing(module);
            setFormOpen(true);
          },
        })}
        filters={moduleFilters}
        searchable
        searchText={(row) => `${row.applicationName} ${row.applicationKey} ${row.key} ${row.name}`}
        searchPlaceholder="Search by application, key or name…"
        selectable={false}
        views={{ builtIn: MODULE_BUILT_IN_VIEWS, storageKey: MODULE_VIEWS_STORAGE_KEY }}
        status={
          applications.loading || modules.loading
            ? 'loading'
            : errorText !== undefined
              ? 'error'
              : 'ready'
        }
        errorCopy={errorText}
        onRetry={() => {
          applications.reload();
          modules.reload();
        }}
        emptyTitle={
          appRows.length === 0 ? 'No applications are registered yet' : 'No modules registered yet'
        }
        emptyDescription={
          appRows.length === 0
            ? 'Register an application first; its modules appear here.'
            : 'Modules registered by each application appear in this list.'
        }
        noResultsTitle="No modules match this filter"
        noResultsDescription="Try a different search, state or application, or clear the filters to see every module."
      />

      <ModuleForm
        open={formOpen}
        onOpenChange={setFormOpen}
        module={editing}
        applications={appRows}
        onSaved={() => {
          modules.reload();
          setEditing(null);
        }}
      />
    </PageBody>
  );
}
