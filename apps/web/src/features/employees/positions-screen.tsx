'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type {
  CreatePositionInput,
  OrganizationalUnitSummary,
  Paginated,
  PositionSummary,
  UpdatePositionInput,
} from '@hris/shared-types';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { getOrganization } from '@/features/organization';
import { ApiRequestError } from '@/lib/api/http-client';
import { apiRequestV1 } from '@/lib/api/client-config';
import { MoreHorizontalIcon, Pencil, Plus, Trash2 } from 'lucide-react';

/**
 * The position master, against the API.
 *
 * A position is the job a person holds: the directory's form picks from this list and
 * sends the id, so the two are the same rows rather than two vocabularies that have to
 * be kept in step. Deletion is the API's (it refuses a position still held by someone),
 * and the message it returns is shown in the confirmation dialog.
 */

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

const listPositions = (): Promise<Paginated<PositionSummary>> =>
  apiRequestV1<Paginated<PositionSummary>>('/employees/positions?limit=100');

const createPosition = (input: CreatePositionInput): Promise<PositionSummary> =>
  apiRequestV1<PositionSummary>('/employees/positions', { method: 'POST', body: input });

const updatePosition = (id: string, input: UpdatePositionInput): Promise<PositionSummary> =>
  apiRequestV1<PositionSummary>(`/employees/positions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });

const deletePosition = (id: string): Promise<void> =>
  apiRequestV1<void>(`/employees/positions/${encodeURIComponent(id)}`, { method: 'DELETE' });

function PositionRowMenu({
  position,
  onEdit,
  onDelete,
}: {
  readonly position: PositionSummary;
  readonly onEdit: (position: PositionSummary) => void;
  readonly onDelete: (position: PositionSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${position.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onEdit(position)}>
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(position)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PositionFormState {
  code: string;
  name: string;
  description: string;
  unitId: string;
  jobGrade: string;
  isActive: boolean;
}

function stateFromPosition(position: PositionSummary | null): PositionFormState {
  return {
    code: position?.code ?? '',
    name: position?.name ?? '',
    description: position?.description ?? '',
    unitId: position?.organizationalUnitId ?? '',
    jobGrade: position?.jobGrade ?? '',
    isActive: position?.isActive ?? true,
  };
}

function PositionDialog({
  open,
  onOpenChange,
  position,
  units,
  onSaved,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly position: PositionSummary | null;
  readonly units: readonly OrganizationalUnitSummary[];
  readonly onSaved: () => void;
}) {
  const [form, setForm] = useState<PositionFormState>(() => stateFromPosition(position));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(stateFromPosition(position));
      setError(undefined);
    }
  }, [open, position]);

  async function submit(): Promise<void> {
    setPending(true);
    setError(undefined);
    try {
      const input = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() === '' ? null : form.description.trim(),
        organizationalUnitId: form.unitId === '' ? null : form.unitId,
        jobGrade: form.jobGrade.trim() === '' ? null : form.jobGrade.trim(),
        isActive: form.isActive,
      };
      if (position === null) {
        await createPosition(input);
      } else {
        await updatePosition(position.id, input);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{position === null ? 'Add a position' : 'Edit position'}</DialogTitle>
          <DialogDescription>
            Positions are the job titles employees can hold. A role can be tied to the department
            that owns it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Code" htmlFor="position-code" required errorId="position-code-error">
              <Input
                id="position-code"
                value={form.code}
                placeholder="POS-HR-MANAGER"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, code: value }));
                }}
              />
            </FormField>
            <FormField label="Name" htmlFor="position-name" required errorId="position-name-error">
              <Input
                id="position-name"
                value={form.name}
                placeholder="HR Manager"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, name: value }));
                }}
              />
            </FormField>
          </div>
          <FormField label="Department" htmlFor="position-unit" errorId="position-unit-error">
            <Select
              value={form.unitId === '' ? 'NONE' : form.unitId}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  unitId: value === null || value === 'NONE' ? '' : value,
                }))
              }
            >
              <SelectTrigger id="position-unit" aria-label="Department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No department</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Job grade" htmlFor="position-grade" errorId="position-grade-error">
            <Input
              id="position-grade"
              value={form.jobGrade}
              placeholder="G7"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, jobGrade: value }));
              }}
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="position-description"
            errorId="position-description-error"
          >
            <Textarea
              id="position-description"
              value={form.description}
              rows={3}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, description: value }));
              }}
            />
          </FormField>
          <div className="flex items-center gap-3">
            <Switch
              id="position-active"
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, isActive: checked === true }))
              }
            />
            <Label htmlFor="position-active">
              Active — offer this position in the employee form
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <FormSubmitButton pending={pending}>
              {position === null ? 'Add position' : 'Save changes'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PositionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const canCreate = useCan('organization.create');
  const canUpdate = useCan('organization.update');
  const canDelete = useCan('organization.delete');

  const units = useIamLoad(
    () => getOrganization().listUnits({ type: 'DEPARTMENT' }, { limit: 100 }),
    [],
  );
  const positions = useIamLoad(listPositions, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PositionSummary | null>(null);
  const [deleting, setDeleting] = useState<PositionSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = positions.data?.items ?? [];

  async function confirmDelete(): Promise<void> {
    if (deleting === null) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await deletePosition(deleting.id);
      toast({
        title: 'Position deleted',
        description: `${deleting.name} has been removed.`,
        variant: 'success',
      });
      setDeleting(null);
      positions.reload();
    } catch (err) {
      setDeleteError(messageOf(err));
    } finally {
      setDeletePending(false);
    }
  }

  const columns: readonly DataTableColumn<PositionSummary>[] = [
    {
      id: 'code',
      header: 'Code',
      sortValue: (position) => position.code,
      cellClassName: 'font-mono text-xs',
      cell: (position) => position.code,
    },
    {
      id: 'name',
      header: 'Position',
      sortValue: (position) => position.name,
      cellClassName: 'font-medium',
      cell: (position) => position.name,
    },
    {
      id: 'department',
      header: 'Department',
      sortValue: (position) => position.organizationalUnitName ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (position) => position.organizationalUnitName ?? '—',
    },
    {
      id: 'grade',
      header: 'Grade',
      sortValue: (position) => position.jobGrade ?? '',
      cell: (position) => position.jobGrade ?? '—',
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (position) => (position.isActive ? 'Active' : 'Inactive'),
      cell: (position) => (
        <Badge variant={position.isActive ? 'success' : 'secondary'}>
          {position.isActive ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (position) =>
        canUpdate || canDelete ? (
          <PositionRowMenu
            position={position}
            onEdit={(target) => {
              setEditing(target);
              setDialogOpen(true);
            }}
            onDelete={(target) => setDeleting(target)}
          />
        ) : null,
    },
  ];

  const filters: readonly DataTableFilter<PositionSummary>[] = [
    {
      kind: 'select',
      id: 'unit',
      label: 'Department',
      placeholder: 'All departments',
      getValue: (position) => position.organizationalUnitId ?? '',
      options: (units.data?.items ?? []).map((unit) => ({ value: unit.id, label: unit.name })),
    },
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (position) => (position.isActive ? 'active' : 'inactive'),
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Positions"
        description="Position master — the jobs the workforce holds, with grades and their owning department."
      />
      {units.error !== undefined && (
        <ErrorPanel error={units.error} onRetry={() => units.reload()} />
      )}
      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchable
        searchText={(position) => `${position.code} ${position.name}`}
        searchPlaceholder="Search positions"
        selectable={false}
        actions={
          canCreate ? (
            <Button
              variant="default"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add position
            </Button>
          ) : undefined
        }
        status={positions.loading ? 'loading' : positions.error !== undefined ? 'error' : 'ready'}
        errorCopy={positions.error}
        onRetry={() => positions.reload()}
        emptyTitle="No positions yet"
        emptyDescription="Add a position so the employee form can offer it as a job title."
        emptyAction={
          canCreate ? (
            <Button
              variant="default"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add position
            </Button>
          ) : undefined
        }
        noResultsTitle="No positions match this filter"
        noResultsDescription="Try a different search or clear the filters to see every position."
      />

      <PositionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        position={editing}
        units={units.data?.items ?? []}
        onSaved={positions.reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete ${deleting?.name ?? 'this position'}?`}
        description={`Delete "${deleting?.name ?? ''}"? A position still held by an employee cannot be deleted.`}
        confirmLabel="Delete position"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
