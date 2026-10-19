'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
 * Custom Fields: tenant-defined fields on registered resources. Fields extend a
 * resource's shape without a migration — each field carries a key, label, data type
 * and whether it is required or sensitive.
 */
export function CustomFieldsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canCreate = useCan('registry.create');
  const canUpdate = useCan('registry.update');
  const canDelete = useCan('registry.delete');

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

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setResources(await platformApi.listRegistryResources());
    } catch (cause) {
      setError(messageOf(cause));
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
    if (!window.confirm(`Remove field "${row.key}" from "${row.resourceName}"?`)) return;
    try {
      await platformApi.removeRegistryResourceField(row.resourceKey, row.key);
      setNotice(`Field "${row.key}" removed.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

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

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : fields.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No custom fields defined yet. Register resources under Resource Registry, then add
              fields here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Fields</CardTitle>
            <CardDescription>
              {fields.length} field{fields.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead className="font-mono text-sm">Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Required</TableHead>
                  <TableHead className="text-center">Sensitive</TableHead>
                  <TableHead className="text-center text-right">Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-sm">{row.resourceName}</TableCell>
                    <TableCell className="font-mono text-sm">{row.key}</TableCell>
                    <TableCell className="text-sm">{row.label}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{row.dataType}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={row.required} disabled readOnly />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={row.isSensitive} disabled readOnly />
                    </TableCell>
                    <TableCell className="text-center text-right font-mono text-sm">
                      {row.sortOrder}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canUpdate && (
                          <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => void remove(row)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
