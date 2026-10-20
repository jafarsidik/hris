'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { configurationSchemasApi } from '@/features/platform/registry-extensions-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { ConfigurationSchemaSummary } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

const STATE_FILTER = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const withState = (state: 'ACTIVE' | 'INACTIVE') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

const SCHEMA_VIEWS_STORAGE_KEY = 'hris:configuration-schemas:views';

const SCHEMA_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All schemas',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'active', name: 'Active', builtIn: true, state: withState('ACTIVE') },
  { id: 'inactive', name: 'Inactive', builtIn: true, state: withState('INACTIVE') },
];

const SCHEMA_FILTERS: readonly DataTableFilter<ConfigurationSchemaSummary>[] = [
  {
    kind: 'select',
    id: 'state',
    label: 'State',
    placeholder: 'All states',
    getValue: (schema) => (schema.isActive ? 'ACTIVE' : 'INACTIVE'),
    options: STATE_FILTER,
  },
];

/**
 * The schema list's columns.
 *
 * The actions column is pinned because the table scrolls horizontally on narrower
 * windows; an actions cell that scrolls out of sight cannot be clicked. Both actions
 * are offered only to a reader with `registry.manage`.
 */
function buildSchemaColumns({
  canManage,
  onToggle,
  onRemove,
}: {
  readonly canManage: boolean;
  readonly onToggle: (schema: ConfigurationSchemaSummary) => void;
  readonly onRemove: (schema: ConfigurationSchemaSummary) => void;
}): readonly DataTableColumn<ConfigurationSchemaSummary>[] {
  const columns: DataTableColumn<ConfigurationSchemaSummary>[] = [
    {
      id: 'resourceKey',
      header: 'Resource',
      sortValue: (schema) => schema.resourceKey,
      cellClassName: 'font-mono text-sm',
      cell: (schema) => schema.resourceKey,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (schema) => schema.name,
      cellClassName: 'font-medium',
      cell: (schema) => schema.name,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (schema) => (schema.isActive ? 'ACTIVE' : 'INACTIVE'),
      cell: (schema) => (
        <Badge variant={schema.isActive ? 'success' : 'secondary'}>
          {schema.isActive ? 'ACTIVE' : 'INACTIVE'}
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
      cell: (schema) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggle(schema)}>
            {schema.isActive ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(schema)}>
            <Trash2 className="mr-1 size-4" aria-hidden />
            Delete
          </Button>
        </div>
      ),
    });
  }

  return columns;
}

/**
 * Configuration Schemas: the validated configuration shapes per registered resource.
 *
 * The list used to be a bare `<table>` inside a `Card` — no search, no sorting, no
 * pagination, no column visibility — and its delete action was a `window.confirm`,
 * which cannot name the record, cannot say what the deletion costs and cannot report
 * a failure. It now renders through the shared table, and delete goes through the
 * confirm dialog: the schema is named, the consequence is stated, the failure stays
 * inside the dialog, and a success raises a toast.
 */
export function ConfigurationSchemasScreen() {
  const router = useRouter();
  const { state } = useSession();
  const schemas = useIamLoad(() => configurationSchemasApi.list(), []);
  const canManage = useCan('registry.manage');
  const { toast } = useToast();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [resourceKey, setResourceKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaJson, setSchemaJson] = useState('{}');
  const [isActive, setIsActive] = useState(true);

  const [confirming, setConfirming] = useState<ConfigurationSchemaSummary | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const resetForm = () => {
    setResourceKey('');
    setName('');
    setDescription('');
    setSchemaJson('{}');
    setIsActive(true);
  };

  const submit = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    let schema: Record<string, unknown> = {};
    try {
      schema = JSON.parse(schemaJson) as Record<string, unknown>;
    } catch {
      setError('Schema is not valid JSON.');
      return;
    }
    setBusy(true);
    try {
      await configurationSchemasApi.create({
        resourceKey,
        name,
        description: description.trim() === '' ? null : description,
        schemaJson: schema,
        isActive,
      });
      setNotice('Configuration schema created.');
      resetForm();
      setShowForm(false);
      schemas.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [resourceKey, name, description, schemaJson, isActive, schemas]);

  const remove = useCallback((schema: ConfigurationSchemaSummary) => {
    setConfirming(schema);
    setConfirmError(undefined);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (confirming === null) {
      return;
    }
    setConfirmPending(true);
    setConfirmError(undefined);
    try {
      await configurationSchemasApi.remove(confirming.id);
      toast({
        title: 'Schema deleted',
        description: `Deleted “${confirming.name}”.`,
        variant: 'success',
      });
      setConfirming(null);
      schemas.reload();
    } catch (cause) {
      setConfirmError(messageOf(cause));
    } finally {
      setConfirmPending(false);
    }
  }, [confirming, schemas, toast]);

  const toggle = useCallback(
    async (schema: ConfigurationSchemaSummary) => {
      setError(undefined);
      try {
        await configurationSchemasApi.toggle(schema.id, !schema.isActive);
        schemas.reload();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
    [schemas],
  );

  const rows = schemas.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Configuration Schemas"
        description="Validated configuration shapes per registered resource."
      />

      {error !== undefined && <ErrorPanel error={error} />}
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
                <CardTitle>New schema</CardTitle>
                <CardDescription>Declare the configuration shape for a resource.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Hide' : 'New schema'}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schema-resource">Resource key</Label>
                  <Input
                    id="schema-resource"
                    value={resourceKey}
                    onChange={(e) => setResourceKey(e.target.value)}
                    placeholder="e.g. payroll"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="schema-name">Name</Label>
                  <Input id="schema-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schema-description">Description</Label>
                <Input
                  id="schema-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schema-json">Schema (JSON)</Label>
                <Textarea
                  id="schema-json"
                  value={schemaJson}
                  onChange={(e) => setSchemaJson(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-end gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={busy || resourceKey.trim() === '' || name.trim() === ''}
                >
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildSchemaColumns({ canManage, onToggle: toggle, onRemove: remove })}
        filters={SCHEMA_FILTERS}
        searchable
        searchText={(schema) => `${schema.resourceKey} ${schema.name}`}
        searchPlaceholder="Search by resource or name…"
        selectable={false}
        views={{ builtIn: SCHEMA_BUILT_IN_VIEWS, storageKey: SCHEMA_VIEWS_STORAGE_KEY }}
        status={schemas.loading ? 'loading' : schemas.error !== undefined ? 'error' : 'ready'}
        errorCopy={schemas.error}
        onRetry={() => schemas.reload()}
        emptyTitle="No schemas yet"
        emptyDescription="Declare the first configuration shape to validate resources against it."
        noResultsTitle="No schemas match this filter"
        noResultsDescription="Try a different search or state, or clear the filters to see every schema."
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
            setConfirmError(undefined);
          }
        }}
        title={confirming !== null ? `Delete “${confirming.name}”?` : 'Delete schema?'}
        description={
          confirming !== null ? (
            <>
              The schema for {confirming.resourceKey} is removed from the registry. Configurations
              already stored keep their values, but the resource is no longer validated against this
              shape.
            </>
          ) : (
            'The schema is removed from the registry.'
          )
        }
        confirmLabel="Delete"
        tone="destructive"
        pending={confirmPending}
        error={confirmError}
        onConfirm={() => void confirmRemove()}
      />
    </PageBody>
  );
}
