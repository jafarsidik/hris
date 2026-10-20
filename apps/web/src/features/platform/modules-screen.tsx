'use client';

import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { ApplicationSummary, ModuleSummary } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

interface ModuleFormInput {
  readonly applicationKey: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

function blankForm(): ModuleFormInput {
  return { applicationKey: '', key: '', name: '', description: '', isActive: true, sortOrder: 0 };
}

/** Create or edit one registered module. */
export function ModuleForm({
  open,
  onOpenChange,
  module,
  applications,
  onSaved,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly module: ModuleSummary | null;
  readonly applications: readonly ApplicationSummary[];
  readonly onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [form, setForm] = useState<ModuleFormInput>(blankForm());

  const isEdit = module !== null;

  useEffect(() => {
    const appKey =
      module === null ? '' : (applications.find((a) => a.id === module.applicationId)?.key ?? '');
    setForm(
      module === null
        ? blankForm()
        : {
            applicationKey: appKey,
            key: module.key,
            name: module.name,
            description: module.description ?? '',
            isActive: module.isActive,
            sortOrder: module.sortOrder,
          },
    );
    setError(undefined);
  }, [module, isEdit, applications]);

  const submit = async () => {
    setError(undefined);
    setBusy(true);
    try {
      const input = {
        applicationKey: form.applicationKey,
        key: form.key,
        name: form.name,
        description: form.description,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };
      if (isEdit && module !== null) {
        await platformApi.updateRegistryModule(module.key, input);
      } else {
        await platformApi.createRegistryModule(input);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const appOptions = applications.slice().sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            {isEdit ? 'Edit module' : 'Register module'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit module' : 'Register module'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Change the module’s name, description, application or active state.'
              : 'Stand up a new functional area within an application.'}
          </DialogDescription>
        </DialogHeader>
        {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormField
            label="Application"
            htmlFor="registry-module-app"
            required
            errorId="registry-module-app-error"
          >
            <Select
              id="registry-module-app"
              disabled={isEdit}
              value={form.applicationKey}
              onValueChange={(value) =>
                setForm({ ...form, applicationKey: value ?? form.applicationKey })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an application" />
              </SelectTrigger>
              <SelectContent>
                {appOptions.map((application) => (
                  <SelectItem key={application.key} value={application.key}>
                    {application.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Key"
            htmlFor="registry-module-key"
            required
            errorId="registry-module-key-error"
          >
            <Input
              id="registry-module-key"
              value={form.key}
              onChange={(event) => setForm({ ...form, key: event.currentTarget.value })}
              placeholder="M10_PROJECTS"
            />
          </FormField>
          <FormField
            label="Name"
            htmlFor="registry-module-name"
            required
            errorId="registry-module-name-error"
          >
            <Input
              id="registry-module-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="registry-module-desc"
            errorId="registry-module-desc-error"
          >
            <Input
              id="registry-module-desc"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Active"
              htmlFor="registry-module-active"
              errorId="registry-module-active-error"
            >
              <input
                id="registry-module-active"
                type="checkbox"
                className="size-4"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.currentTarget.checked })}
              />
            </FormField>
            <FormField
              label="Sort order"
              htmlFor="registry-module-sort"
              errorId="registry-module-sort-error"
            >
              <Input
                id="registry-module-sort"
                type="number"
                value={String(form.sortOrder)}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: Number(event.currentTarget.value) || 0 })
                }
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <FormSubmitButton
              pending={busy}
              disabled={!form.applicationKey || form.key.length < 2 || form.name.length < 2}
            >
              {isEdit ? 'Save changes' : 'Register'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const MODULE_VIEWS_STORAGE_KEY = 'hris:modules:views';

const MODULE_STATE_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

function buildModuleFilters(
  applications: readonly ApplicationSummary[],
): readonly DataTableFilter<ModuleSummary>[] {
  const appOptions = applications
    .map((app) => ({ value: app.id, label: app.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [
    {
      kind: 'select',
      id: 'application',
      label: 'Application',
      placeholder: 'All applications',
      getValue: (row) => row.applicationId,
      options: appOptions,
    },
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
      options: MODULE_STATE_OPTIONS,
    },
  ];
}

const withModuleState = (state: 'ACTIVE' | 'INACTIVE') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

const MODULE_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All modules',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'active', name: 'Active', builtIn: true, state: withModuleState('ACTIVE') },
  { id: 'inactive', name: 'Inactive', builtIn: true, state: withModuleState('INACTIVE') },
];

function buildModuleColumns({
  applications,
  onEdit,
}: {
  readonly applications: readonly ApplicationSummary[];
  readonly onEdit?: (module: ModuleSummary) => void;
}): readonly DataTableColumn<ModuleSummary>[] {
  const appMap = new Map(applications.map((app) => [app.id, app]));

  const columns: DataTableColumn<ModuleSummary>[] = [
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
      id: 'application',
      header: 'Application',
      sortValue: (row) => appMap.get(row.applicationId)?.name ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (row) => appMap.get(row.applicationId)?.name ?? '—',
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

  if (onEdit !== undefined) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
            Edit
          </Button>
        </div>
      ),
    });
  }

  return columns;
}

export function ModulesScreen() {
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

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleSummary | null>(null);

  const appRows = applications.data ?? [];
  const moduleRows = modules.data ?? [];

  const loading = applications.loading || modules.loading;
  const error = applications.error ?? modules.error;

  return (
    <PageBody>
      <PageHeader
        title="Module Registry"
        description="Modules owned by each application — the functional areas that register resources."
        actions={
          <ModuleForm
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setEditing(null);
              }
            }}
            module={editing}
            applications={appRows}
            onSaved={() => {
              modules.reload();
              applications.reload();
              setEditing(null);
            }}
          />
        }
      />

      <HrisDataTable
        rows={moduleRows}
        columns={buildModuleColumns({
          applications: appRows,
          onEdit: canManage
            ? (module) => {
                setEditing(module);
                setOpen(true);
              }
            : undefined,
        })}
        filters={buildModuleFilters(appRows)}
        searchable
        searchText={(row) => {
          const app = appRows.find((a) => a.id === row.applicationId);
          return [row.key, row.name, app?.name ?? ''].join(' ');
        }}
        searchPlaceholder="Search by key, name or application…"
        selectable={false}
        views={{ builtIn: MODULE_BUILT_IN_VIEWS, storageKey: MODULE_VIEWS_STORAGE_KEY }}
        status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
        errorCopy={error}
        onRetry={() => {
          applications.reload();
          modules.reload();
        }}
        emptyTitle="No modules are registered yet"
        emptyDescription="Register a module to stand up a new functional area within an application."
        noResultsTitle="No modules match this filter"
        noResultsDescription="Try a different search or clear the filters to see every module."
      />
    </PageBody>
  );
}
