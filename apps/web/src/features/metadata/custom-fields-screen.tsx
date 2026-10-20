'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontalIcon, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { useCan, useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';

import { platformApi } from '@/features/platform/platform-api';
import { FIELD_DATA_TYPES, type FieldDataType, type ResourceSummary } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

interface FieldRow {
  readonly resourceKey: string;
  readonly resourceName: string;
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly dataType: FieldDataType;
  readonly required: boolean;
  readonly isSensitive: boolean;
  readonly sortOrder: number;
}

/**
 * The per-row actions menu for custom fields.
 *
 * Edit is available to readers with `registry.update`; delete to readers with
 * `registry.delete`. The destructive direction is confirmed by the screen's
 * ConfirmDialog.
 */
function FieldRowMenu({
  field,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: {
  readonly field: FieldRow;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onEdit: (field: FieldRow) => void;
  readonly onDelete: (field: FieldRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${field.label}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {canUpdate && (
          <DropdownMenuItem onClick={() => onEdit(field)}>
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(field)}>
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Custom Fields: tenant-defined fields on registered resources. Fields extend a
 * resource's shape without a migration — each field carries a key, label, data type
 * and whether it is required or sensitive.
 *
 * The rows are computed in memory from the registry resources, so the shared
 * table's own search, sort and pagination apply directly.
 */
export function CustomFieldsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canCreate = useCan('registry.create');
  const canUpdate = useCan('registry.update');
  const canDelete = useCan('registry.delete');

  const [loadError, setLoadError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [resources, setResources] = useState<readonly ResourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FieldRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    resourceKey: string;
    key: string;
    label: string;
    dataType: FieldDataType;
    required: boolean;
    isSensitive: boolean;
    sortOrder: number;
  } | null>(null);
  const [confirming, setConfirming] = useState<FieldRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setResources(await platformApi.listRegistryResources());
    } catch (cause) {
      setLoadError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fields: FieldRow[] = [];
  for (const resource of resources) {
    for (const field of resource.fields ?? []) {
      fields.push({
        resourceKey: resource.key,
        resourceName: resource.name,
        ...field,
      });
    }
  }
  fields.sort((a, b) => a.resourceName.localeCompare(b.resourceName) || a.sortOrder - b.sortOrder);

  const openAdd = () => {
    setEditing(null);
    setForm({
      resourceKey: resources[0]?.key ?? '',
      key: '',
      label: '',
      dataType: FIELD_DATA_TYPES[0],
      required: false,
      isSensitive: false,
      sortOrder: 0,
    });
    setError(undefined);
    setDialogOpen(true);
  };

  const openEdit = (row: FieldRow) => {
    setEditing(row);
    setForm({
      resourceKey: row.resourceKey,
      key: row.key,
      label: row.label,
      dataType: row.dataType,
      required: row.required,
      isSensitive: row.isSensitive,
      sortOrder: row.sortOrder,
    });
    setError(undefined);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form) return;
    setError(undefined);
    setSaving(true);
    try {
      const input = {
        key: form.key.trim(),
        label: form.label.trim(),
        dataType: form.dataType,
        required: form.required,
        isSensitive: form.isSensitive,
        sortOrder: form.sortOrder,
      };
      if (editing === null) {
        await platformApi.addRegistryResourceField(form.resourceKey, input);
        setNotice(`Field "${input.key}" added to ${form.resourceKey}.`);
      } else {
        await platformApi.updateRegistryResourceField(form.resourceKey, editing.key, {
          label: input.label,
          required: input.required,
          isSensitive: input.isSensitive,
          sortOrder: input.sortOrder,
        });
        setNotice(`Field "${input.key}" updated.`);
      }
      setDialogOpen(false);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: FieldRow) => {
    setConfirmError(undefined);
    setRemoving(true);
    try {
      await platformApi.removeRegistryResourceField(row.resourceKey, row.key);
      setNotice(`Field "${row.key}" removed.`);
      await load();
    } catch (cause) {
      setConfirmError(messageOf(cause));
    } finally {
      setRemoving(false);
    }
  };

  const columns: readonly DataTableColumn<FieldRow>[] = [
    {
      id: 'resource',
      header: 'Resource',
      sortValue: (row) => row.resourceName,
      cellClassName: 'font-medium text-sm',
      cell: (row) => row.resourceName,
    },
    {
      id: 'key',
      header: 'Key',
      sortValue: (row) => row.key,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.key,
    },
    {
      id: 'label',
      header: 'Label',
      sortValue: (row) => row.label,
      cellClassName: 'text-sm',
      cell: (row) => row.label,
    },
    {
      id: 'type',
      header: 'Type',
      sortValue: (row) => row.dataType,
      align: 'center',
      cellClassName: 'font-mono text-xs',
      cell: (row) => row.dataType,
    },
    {
      id: 'required',
      header: 'Required',
      align: 'center',
      cell: (row) => <Switch checked={row.required} disabled readOnly />,
    },
    {
      id: 'sensitive',
      header: 'Sensitive',
      align: 'center',
      cell: (row) => <Switch checked={row.isSensitive} disabled readOnly />,
    },
    {
      id: 'order',
      header: 'Order',
      sortValue: (row) => row.sortOrder,
      align: 'center',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.sortOrder,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => (
        <FieldRowMenu
          field={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={openEdit}
          onDelete={(f) => setConfirming(f)}
        />
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Custom Fields"
        description="Tenant-defined fields on registered resources."
        actions={
          canCreate && (
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="mr-1 size-4" aria-hidden />
              Add field
            </Button>
          )
        }
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <HrisDataTable
        rows={fields}
        columns={columns}
        searchable
        searchText={(row) => `${row.resourceName} ${row.key} ${row.label} ${row.dataType}`}
        searchPlaceholder="Search by resource, key, label or type…"
        selectable={false}
        status={loading ? 'loading' : loadError !== undefined ? 'error' : 'ready'}
        errorCopy={loadError}
        onRetry={() => void load()}
        emptyTitle="No custom fields defined yet"
        emptyDescription="Register resources under Resource Registry, then add fields here."
        noResultsTitle="No fields match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every field."
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
            setConfirmError(undefined);
          }
        }}
        title={
          confirming !== null
            ? `Remove field "${confirming.key}" from "${confirming.resourceName}"?`
            : ''
        }
        description="The field is removed from the resource. Stored values are kept but no longer editable."
        confirmLabel="Remove"
        tone="destructive"
        pending={removing}
        error={confirmError}
        onConfirm={() => {
          if (confirming !== null) {
            void remove(confirming);
          }
        }}
      />

      {form !== null && (
        <Dialog
          open={dialogOpen}
          onOpenChange={(next) => {
            if (!next) {
              setDialogOpen(false);
              setForm(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editing === null ? 'Add custom field' : 'Edit custom field'}
              </DialogTitle>
              <DialogDescription>
                Editing the label and constraints only; key and data type are fixed after creation.
              </DialogDescription>
            </DialogHeader>
            {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <FormField
                label="Resource"
                htmlFor="field-resource"
                required
                errorId="field-resource-error"
              >
                <Select
                  id="field-resource"
                  value={form.resourceKey}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current === null ? current : { ...current, resourceKey: value ?? '' },
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map((resource) => (
                      <SelectItem key={resource.key} value={resource.key}>
                        {resource.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              {editing === null && (
                <FormField label="Field key" htmlFor="field-key" required errorId="field-key-error">
                  <Input
                    id="field-key"
                    placeholder="due-date"
                    value={form.key}
                    onChange={(event) =>
                      setForm((current) =>
                        current === null ? current : { ...current, key: event.currentTarget.value },
                      )
                    }
                  />
                </FormField>
              )}
              <FormField label="Label" htmlFor="field-label" required errorId="field-label-error">
                <Input
                  id="field-label"
                  value={form.label}
                  onChange={(event) =>
                    setForm((current) =>
                      current === null ? current : { ...current, label: event.currentTarget.value },
                    )
                  }
                />
              </FormField>
              <FormField
                label="Data type"
                htmlFor="field-datatype"
                required
                errorId="field-datatype-error"
              >
                <Select
                  id="field-datatype"
                  value={form.dataType}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current === null ? current : { ...current, dataType: value as FieldDataType },
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_DATA_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="grid gap-2 sm:grid-cols-3">
                <FormField label="Required" htmlFor="field-required" errorId="field-required-error">
                  <Switch
                    id="field-required"
                    checked={form.required}
                    onCheckedChange={(next) =>
                      setForm((current) =>
                        current === null ? current : { ...current, required: next },
                      )
                    }
                  />
                </FormField>
                <FormField
                  label="Sensitive"
                  htmlFor="field-sensitive"
                  errorId="field-sensitive-error"
                >
                  <Switch
                    id="field-sensitive"
                    checked={form.isSensitive}
                    onCheckedChange={(next) =>
                      setForm((current) =>
                        current === null ? current : { ...current, isSensitive: next },
                      )
                    }
                  />
                </FormField>
                <FormField label="Sort order" htmlFor="field-order" errorId="field-order-error">
                  <Input
                    id="field-order"
                    type="number"
                    value={String(form.sortOrder)}
                    onChange={(event) => {
                      const next = Number(event.currentTarget.value);
                      setForm((current) =>
                        current === null
                          ? current
                          : { ...current, sortOrder: Number.isFinite(next) ? next : 0 },
                      );
                    }}
                  />
                </FormField>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={form === null}
                  onClick={() => {
                    setDialogOpen(false);
                    setForm(null);
                  }}
                >
                  Cancel
                </Button>
                <FormSubmitButton pending={saving} disabled={form === null}>
                  {editing === null ? 'Add field' : 'Save changes'}
                </FormSubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </PageBody>
  );
}
