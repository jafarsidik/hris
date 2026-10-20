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
import { Plus } from 'lucide-react';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { ApplicationSummary } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

interface ApplicationFormInput {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
}

function blankForm(): ApplicationFormInput {
  return { key: '', name: '', description: '', isActive: true };
}

/** Create or edit one registered application. */
function ApplicationForm({
  open,
  onOpenChange,
  application,
  onSaved,
  disabled = false,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly application: ApplicationSummary | null;
  readonly onSaved: () => void;
  readonly disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [form, setForm] = useState<ApplicationFormInput>(blankForm());

  const isEdit = application !== null;

  useEffect(() => {
    setForm(
      application === null
        ? blankForm()
        : {
            key: application.key,
            name: application.name,
            description: application.description ?? '',
            isActive: application.isActive,
          },
    );
    setError(undefined);
  }, [application, isEdit]);

  const submit = async () => {
    setError(undefined);
    setBusy(true);
    try {
      if (isEdit && application !== null) {
        await platformApi.updateRegistryApplication(application.key, {
          name: form.name,
          description: form.description,
          isActive: form.isActive,
        });
      } else {
        await platformApi.createRegistryApplication({
          key: form.key,
          name: form.name,
          description: form.description,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled}>
            {!isEdit && <Plus className="mr-1 size-4" aria-hidden="true" />}
            {isEdit ? 'Edit application' : 'Register application'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit application' : 'Register application'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Change the application’s name, description or active state.'
              : 'Stand up a new deployed application that owns modules and resources.'}
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
            label="Key"
            htmlFor="registry-app-key"
            required
            errorId="registry-app-key-error"
          >
            <Input
              id="registry-app-key"
              disabled={isEdit}
              value={form.key}
              onChange={(event) => setForm({ ...form, key: event.currentTarget.value })}
              placeholder="project-tracker"
            />
            <p className="text-xs text-muted-foreground">
              Machine key used in URLs and permissions.
            </p>
          </FormField>
          <FormField
            label="Name"
            htmlFor="registry-app-name"
            required
            errorId="registry-app-name-error"
          >
            <Input
              id="registry-app-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="registry-app-desc"
            errorId="registry-app-desc-error"
          >
            <Input
              id="registry-app-desc"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
            />
          </FormField>
          <FormField
            label="Active"
            htmlFor="registry-app-active"
            errorId="registry-app-active-error"
          >
            <input
              id="registry-app-active"
              type="checkbox"
              className="size-4"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.currentTarget.checked })}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <FormSubmitButton pending={busy} disabled={form.key.length < 2 || form.name.length < 2}>
              {isEdit ? 'Save changes' : 'Register'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATE_FILTER = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const withState = (state: 'ACTIVE' | 'INACTIVE') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

const APPLICATION_VIEWS_STORAGE_KEY = 'hris:applications:views';

/**
 * The registry's built-in views: the whole list plus one per state, so "show me the
 * inactive applications" is a click away without touching the filter dropdown.
 */
const APPLICATION_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All applications',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'active', name: 'Active', builtIn: true, state: withState('ACTIVE') },
  { id: 'inactive', name: 'Inactive', builtIn: true, state: withState('INACTIVE') },
];

const APPLICATION_FILTERS: readonly DataTableFilter<ApplicationSummary>[] = [
  {
    kind: 'select',
    id: 'state',
    label: 'State',
    placeholder: 'All states',
    getValue: (application) => (application.isActive ? 'ACTIVE' : 'INACTIVE'),
    options: STATE_FILTER,
  },
];

/**
 * The application registry's columns.
 *
 * The actions column is pinned because the table scrolls horizontally on narrower
 * windows and an Edit button that scrolls out of sight is an Edit button that cannot
 * be clicked. It is offered only to a reader with `registry.manage`; everyone else
 * gets the four data columns and no menu.
 */
function buildApplicationColumns({
  canManage,
  onEdit,
}: {
  readonly canManage: boolean;
  readonly onEdit: (application: ApplicationSummary) => void;
}): readonly DataTableColumn<ApplicationSummary>[] {
  const columns: DataTableColumn<ApplicationSummary>[] = [
    {
      id: 'key',
      header: 'Key',
      sortValue: (application) => application.key,
      cellClassName: 'font-mono text-sm',
      cell: (application) => application.key,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (application) => application.name,
      cellClassName: 'font-medium',
      cell: (application) => application.name,
    },
    {
      id: 'description',
      header: 'Description',
      sortValue: (application) => application.description ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (application) => application.description ?? '—',
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (application) => (application.isActive ? 'ACTIVE' : 'INACTIVE'),
      cell: (application) => (
        <Badge variant={application.isActive ? 'success' : 'secondary'}>
          {application.isActive ? 'ACTIVE' : 'INACTIVE'}
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
      cell: (application) => (
        <Button variant="outline" size="sm" onClick={() => onEdit(application)}>
          Edit
        </Button>
      ),
    });
  }

  return columns;
}

/**
 * Application Registry: the deployed applications that own modules and resources.
 *
 * The list used to be a bare `<table>` inside a `Card` with a skeleton while loading
 * and a one-line empty state — no search, no sorting, no pagination and no column
 * visibility, while every other list in the console had all four. It now renders
 * through the shared table, which brings those plus consistent loading, empty and
 * error states. Filtering is client-side and honest here: the API returns the whole
 * registry, so searching and sorting never claim more than the rows in hand.
 */
export function ApplicationsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const applications = useIamLoad(() => platformApi.listRegistryApplications(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationSummary | null>(null);

  const rows = applications.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Application Registry"
        description="Deployed applications registered on the platform. Each application owns modules and resources."
      />

      {/*
        The register button lives in the table's toolbar slot rather than a card
        header: the shared table brings its own card, and the action belongs with
        the list it adds to.
      */}
      <HrisDataTable
        rows={rows}
        columns={buildApplicationColumns({
          canManage,
          onEdit: (application) => {
            setEditing(application);
            setOpen(true);
          },
        })}
        filters={APPLICATION_FILTERS}
        searchable
        searchText={(application) =>
          `${application.key} ${application.name} ${application.description ?? ''}`
        }
        searchPlaceholder="Search by key, name or description…"
        selectable={false}
        views={{ builtIn: APPLICATION_BUILT_IN_VIEWS, storageKey: APPLICATION_VIEWS_STORAGE_KEY }}
        actions={
          <ApplicationForm
            open={open}
            onOpenChange={setOpen}
            application={editing}
            onSaved={() => {
              applications.reload();
              setEditing(null);
            }}
            disabled={!canManage || applications.loading}
          />
        }
        status={
          applications.loading ? 'loading' : applications.error !== undefined ? 'error' : 'ready'
        }
        errorCopy={applications.error}
        onRetry={() => applications.reload()}
        emptyTitle="No applications are registered yet"
        emptyDescription="Register the first deployed application to start grouping modules and resources."
        noResultsTitle="No applications match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every application."
      />
    </PageBody>
  );
}
