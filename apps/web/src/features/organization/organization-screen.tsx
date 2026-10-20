'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  ORGANIZATIONAL_UNIT_TYPES,
  type OrganizationalUnitSummary,
  type OrganizationalUnitType,
  type OrganizationEntitySummary,
} from '@hris/shared-types';

import {
  HrisDataTable,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ApiRequestError } from '@/lib/api/http-client';
import { MoreHorizontalIcon, Pencil, Plus, Trash2 } from 'lucide-react';

import { getOrganization } from './index';

/** Turns an unknown rejection into a message a form or notice can render inline. */
function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

/** Sentinel for the "no selection" choice, because a Base UI Select value cannot be null. */
const NONE = '__none__';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Notice({ message }: { readonly message: string | undefined }) {
  if (message === undefined) {
    return null;
  }
  return <ErrorPanel error={message} />;
}

function EntityRowMenu({
  entity,
  onEdit,
  onDelete,
}: {
  readonly entity: OrganizationEntitySummary;
  readonly onEdit: (entity: OrganizationEntitySummary) => void;
  readonly onDelete: (entity: OrganizationEntitySummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${entity.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onEdit(entity)}>
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(entity)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UnitRowMenu({
  unit,
  onEdit,
  onDelete,
}: {
  readonly unit: OrganizationalUnitSummary;
  readonly onEdit: (unit: OrganizationalUnitSummary) => void;
  readonly onDelete: (unit: OrganizationalUnitSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${unit.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onEdit(unit)}>
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(unit)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface EntityFormState {
  code: string;
  name: string;
  countryCode: string;
  currencyCode: string;
}

function stateFromEntity(entity: OrganizationEntitySummary | null): EntityFormState {
  return {
    code: entity?.code ?? '',
    name: entity?.name ?? '',
    countryCode: entity?.countryCode ?? 'ID',
    currencyCode: entity?.currencyCode ?? 'IDR',
  };
}

/** Create/edit form for a legal entity. */
function EntityDialog({
  open,
  onOpenChange,
  entity,
  onSaved,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly entity: OrganizationEntitySummary | null;
  readonly onSaved: () => void;
}) {
  const repository = getOrganization();
  const [form, setForm] = useState<EntityFormState>(() => stateFromEntity(entity));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(stateFromEntity(entity));
      setError(undefined);
    }
  }, [open, entity]);

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      if (entity === null) {
        await repository.createEntity({
          code: form.code,
          name: form.name,
          countryCode: form.countryCode.toUpperCase(),
          currencyCode: form.currencyCode.toUpperCase(),
        });
      } else {
        await repository.updateEntity(entity.id, {
          code: form.code,
          name: form.name,
          countryCode: form.countryCode.toUpperCase(),
          currencyCode: form.currencyCode.toUpperCase(),
        });
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
          <DialogTitle>{entity === null ? 'Add a legal entity' : 'Edit legal entity'}</DialogTitle>
          <DialogDescription>
            A legal entity is the employing company, branch or subsidiary that units hang under.
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
          <FormField
            label="Code"
            htmlFor="entity-code"
            required
            error={undefined}
            errorId="entity-code-error"
          >
            <Input
              id="entity-code"
              autoComplete="off"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.currentTarget.value })}
              required
            />
          </FormField>
          <FormField
            label="Name"
            htmlFor="entity-name"
            required
            error={undefined}
            errorId="entity-name-error"
          >
            <Input
              id="entity-name"
              autoComplete="off"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Country"
              htmlFor="entity-country"
              required
              hint="Two-letter ISO country code."
              error={undefined}
              errorId="entity-country-error"
            >
              <Input
                id="entity-country"
                autoComplete="off"
                maxLength={2}
                value={form.countryCode}
                onChange={(event) => setForm({ ...form, countryCode: event.currentTarget.value })}
                required
              />
            </FormField>
            <FormField
              label="Currency"
              htmlFor="entity-currency"
              required
              hint="Three-letter ISO currency code."
              error={undefined}
              errorId="entity-currency-error"
            >
              <Input
                id="entity-currency"
                autoComplete="off"
                maxLength={3}
                value={form.currencyCode}
                onChange={(event) => setForm({ ...form, currencyCode: event.currentTarget.value })}
                required
              />
            </FormField>
          </div>
          <DialogFooter>
            <FormSubmitButton pending={pending} pendingText="Saving…">
              {entity === null ? 'Create entity' : 'Save changes'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EntitiesTab() {
  const repository = getOrganization();
  const canCreate = useCan('organization.create');
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationEntitySummary | null>(null);
  const [deleting, setDeleting] = useState<OrganizationEntitySummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const list = useIamLoad(() => repository.listEntities({}, {}), []);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(entity: OrganizationEntitySummary) {
    setEditing(entity);
    setDialogOpen(true);
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) {
      return;
    }
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await repository.deleteEntity(deleting.id);
      toast({
        title: 'Entity deleted',
        description: `${deleting.name} has been removed.`,
        variant: 'success',
      });
      setDeleting(null);
      list.reload();
    } catch (err) {
      setDeleteError(messageOf(err));
    } finally {
      setDeletePending(false);
    }
  }

  const rows = list.data?.items ?? [];

  const columns: readonly DataTableColumn<OrganizationEntitySummary>[] = [
    {
      id: 'code',
      header: 'Code',
      sortValue: (entity) => entity.code,
      cellClassName: 'font-mono text-xs',
      cell: (entity) => entity.code,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (entity) => entity.name,
      cellClassName: 'font-medium',
      cell: (entity) => entity.name,
    },
    {
      id: 'country',
      header: 'Country',
      sortValue: (entity) => entity.countryCode,
      cell: (entity) => entity.countryCode,
    },
    {
      id: 'currency',
      header: 'Currency',
      sortValue: (entity) => entity.currencyCode,
      cell: (entity) => entity.currencyCode,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (entity) => (
        <EntityRowMenu
          entity={entity}
          onEdit={openEdit}
          onDelete={(target) => setDeleting(target)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <HrisDataTable
        rows={rows}
        columns={columns}
        searchable
        searchText={(entity) => `${entity.code} ${entity.name}`}
        searchPlaceholder="Search entities"
        selectable={false}
        actions={
          canCreate ? (
            <Button variant="default" onClick={openCreate}>
              <Plus aria-hidden="true" className="size-4" />
              Add entity
            </Button>
          ) : undefined
        }
        status={list.loading ? 'loading' : list.error !== undefined ? 'error' : 'ready'}
        errorCopy={list.error}
        onRetry={() => list.reload()}
        emptyTitle="No legal entities yet"
        emptyDescription="Create a legal entity to start building the organizational structure."
        noResultsTitle="No legal entities match this filter"
        noResultsDescription="Try a different search or clear the filters to see every entity."
      />

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entity={editing}
        onSaved={list.reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete ${deleting?.name ?? 'this entity'}?`}
        description={`Delete "${deleting?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete entity"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

interface UnitFormState {
  code: string;
  name: string;
  type: OrganizationalUnitType;
  entityId: string | null;
  parentId: string | null;
}

function stateFromUnit(
  unit: OrganizationalUnitSummary | null,
  defaultType: OrganizationalUnitType = 'DEPARTMENT',
): UnitFormState {
  return {
    code: unit?.code ?? '',
    name: unit?.name ?? '',
    type: unit?.type ?? defaultType,
    entityId: unit?.entityId ?? null,
    parentId: unit?.parentId ?? null,
  };
}

/** Create/edit form for an organizational unit. */
function UnitDialog({
  open,
  onOpenChange,
  unit,
  entities,
  units,
  onSaved,
  defaultType = 'DEPARTMENT',
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly unit: OrganizationalUnitSummary | null;
  readonly entities: readonly OrganizationEntitySummary[];
  readonly units: readonly OrganizationalUnitSummary[];
  readonly onSaved: () => void;
  /** The type a new unit starts as; ignored when editing. */
  readonly defaultType?: OrganizationalUnitType;
}) {
  const repository = getOrganization();
  const [form, setForm] = useState<UnitFormState>(() => stateFromUnit(unit, defaultType));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(stateFromUnit(unit, defaultType));
      setError(undefined);
    }
  }, [open, unit, defaultType]);

  const parentOptions = units.filter((candidate) => candidate.id !== unit?.id);

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      if (unit === null) {
        await repository.createUnit({
          code: form.code,
          name: form.name,
          type: form.type,
          entityId: form.entityId,
          parentId: form.parentId,
        });
      } else {
        await repository.updateUnit(unit.id, {
          code: form.code,
          name: form.name,
          type: form.type,
          entityId: form.entityId,
          parentId: form.parentId,
        });
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
          <DialogTitle>
            {unit === null ? 'Add an organizational unit' : 'Edit organizational unit'}
          </DialogTitle>
          <DialogDescription>
            Units form a tree under a legal entity — divisions, departments, sections and teams.
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
          <FormField
            label="Code"
            htmlFor="unit-code"
            required
            error={undefined}
            errorId="unit-code-error"
          >
            <Input
              id="unit-code"
              autoComplete="off"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.currentTarget.value })}
              required
            />
          </FormField>
          <FormField
            label="Name"
            htmlFor="unit-name"
            required
            error={undefined}
            errorId="unit-name-error"
          >
            <Input
              id="unit-name"
              autoComplete="off"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              required
            />
          </FormField>
          <FormField
            label="Type"
            htmlFor="unit-type"
            required
            error={undefined}
            errorId="unit-type-error"
          >
            <Select
              value={form.type}
              onValueChange={(value) => {
                if (value !== null) {
                  setForm({ ...form, type: value as OrganizationalUnitType });
                }
              }}
            >
              <SelectTrigger id="unit-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATIONAL_UNIT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Legal entity"
            htmlFor="unit-entity"
            error={undefined}
            errorId="unit-entity-error"
            hint="Optional. An entity carries its ownership down the unit tree."
          >
            <Select
              value={form.entityId ?? NONE}
              onValueChange={(value) =>
                setForm({ ...form, entityId: value === NONE ? null : value })
              }
            >
              <SelectTrigger id="unit-entity" className="w-full">
                <SelectValue placeholder="No entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No entity</SelectItem>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Parent unit"
            htmlFor="unit-parent"
            error={undefined}
            errorId="unit-parent-error"
            hint="Optional. A root unit sits directly under the entity."
          >
            <Select
              value={form.parentId ?? NONE}
              onValueChange={(value) =>
                setForm({ ...form, parentId: value === NONE ? null : value })
              }
            >
              <SelectTrigger id="unit-parent" className="w-full">
                <SelectValue placeholder="No parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No parent</SelectItem>
                {parentOptions.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <FormSubmitButton pending={pending} pendingText="Saving…">
              {unit === null ? 'Create unit' : 'Save changes'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnitsTab({
  entities,
  lockedType,
}: {
  readonly entities: readonly OrganizationEntitySummary[];
  /**
   * When set, the tab becomes a focused view of one unit type: the rows are filtered,
   * the type filter disappears (it would only offer a single value), and new units
   * default to that type. The Departments screen uses this instead of duplicating the
   * table, the dialog and the delete confirmation.
   */
  readonly lockedType?: OrganizationalUnitType;
}) {
  const repository = getOrganization();
  const canCreate = useCan('organization.create');
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationalUnitSummary | null>(null);
  const [deleting, setDeleting] = useState<OrganizationalUnitSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const list = useIamLoad(() => repository.listUnits({}, { limit: 100 }), []);

  const units = list.data?.items ?? [];
  const nameOf = (id: string | null): string => {
    if (id === null) {
      return '—';
    }
    return units.find((unit) => unit.id === id)?.name ?? id;
  };

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(unit: OrganizationalUnitSummary) {
    setEditing(unit);
    setDialogOpen(true);
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) {
      return;
    }
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await repository.deleteUnit(deleting.id);
      toast({
        title: 'Unit deleted',
        description: `${deleting.name} has been removed.`,
        variant: 'success',
      });
      setDeleting(null);
      list.reload();
    } catch (err) {
      setDeleteError(messageOf(err));
    } finally {
      setDeletePending(false);
    }
  }

  const rows = lockedType === undefined ? units : units.filter((unit) => unit.type === lockedType);

  const columns: readonly DataTableColumn<OrganizationalUnitSummary>[] = [
    {
      id: 'code',
      header: 'Code',
      sortValue: (unit) => unit.code,
      cellClassName: 'font-mono text-xs',
      cell: (unit) => unit.code,
    },
    {
      id: 'name',
      header: 'Name',
      sortValue: (unit) => unit.name,
      cellClassName: 'font-medium',
      cell: (unit) => unit.name,
    },
    {
      id: 'type',
      header: 'Type',
      sortValue: (unit) => unit.type,
      cell: (unit) => <Badge variant="secondary">{unit.type}</Badge>,
    },
    {
      id: 'parent',
      header: 'Parent',
      sortValue: (unit) => nameOf(unit.parentId),
      cellClassName: 'text-muted-foreground',
      cell: (unit) => nameOf(unit.parentId),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (unit) => (
        <UnitRowMenu unit={unit} onEdit={openEdit} onDelete={(target) => setDeleting(target)} />
      ),
    },
  ];

  const filters: readonly DataTableFilter<OrganizationalUnitSummary>[] = [
    {
      kind: 'select',
      id: 'entity',
      label: 'Legal entity',
      placeholder: 'All entities',
      getValue: (unit) => unit.entityId ?? '',
      options: entities.map((entity) => ({ value: entity.id, label: entity.name })),
    },
    ...(lockedType === undefined
      ? [
          {
            kind: 'select' as const,
            id: 'type',
            label: 'Type',
            placeholder: 'All types',
            getValue: (unit: OrganizationalUnitSummary) => unit.type,
            options: ORGANIZATIONAL_UNIT_TYPES.map((type) => ({ value: type, label: type })),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchable
        searchText={(unit) => `${unit.code} ${unit.name}`}
        searchPlaceholder="Search units"
        selectable={false}
        actions={
          canCreate ? (
            <Button variant="default" onClick={openCreate}>
              <Plus aria-hidden="true" className="size-4" />
              {lockedType === 'DEPARTMENT' ? 'Add department' : 'Add unit'}
            </Button>
          ) : undefined
        }
        status={list.loading ? 'loading' : list.error !== undefined ? 'error' : 'ready'}
        errorCopy={list.error}
        onRetry={() => list.reload()}
        emptyTitle={
          lockedType === 'DEPARTMENT' ? 'No departments yet' : 'No organizational units yet'
        }
        emptyDescription="Create a unit to start building the organizational structure."
        emptyAction={
          canCreate ? (
            <Button variant="default" onClick={openCreate}>
              <Plus aria-hidden="true" className="size-4" />
              {lockedType === 'DEPARTMENT' ? 'Add department' : 'Add unit'}
            </Button>
          ) : undefined
        }
        noResultsTitle="No organizational units match this filter"
        noResultsDescription="Try a different search or clear the filters to see every unit."
      />

      <UnitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        unit={editing}
        entities={entities}
        units={units}
        defaultType={lockedType ?? 'DEPARTMENT'}
        onSaved={list.reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete ${deleting?.name ?? 'this unit'}?`}
        description={`Delete "${deleting?.name ?? ''}"? This cannot be undone.`}
        confirmLabel={lockedType === 'DEPARTMENT' ? 'Delete department' : 'Delete unit'}
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

/**
 * Departments: the `DEPARTMENT` slice of the unit tree.
 *
 * A focused view over the same repository and table as the Structure tab. It exists as
 * its own route because "Departments" is where HR looks first; keeping one implementation
 * means a unit created here appears in the org chart and the employee form immediately,
 * and there is no second copy of the department list to drift.
 */
export function DepartmentsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getOrganization();
  const entities = useIamLoad(() => repository.listEntities({}, { limit: 200 }), []);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader
        title="Departments"
        description="Departments are organizational units of type DEPARTMENT — the structure people are placed into across the company."
      />
      <UnitsTab entities={entities.data?.items ?? []} lockedType="DEPARTMENT" />
    </PageBody>
  );
}

/**
 * The organizational-structure administration screen.
 *
 * Two tabs over the same hierarchy: legal entities and the unit tree beneath them. Every
 * read is scoped server-side, and every mutation is gated by its own `organization.*`
 * permission, so the buttons here are affordances rather than the boundary.
 */
export function OrganizationScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getOrganization();
  const entities = useIamLoad(() => repository.listEntities({}, { limit: 200 }), []);
  const [tab, setTab] = useState('entities');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader
        title="Organizations"
        description="Legal entities and the organizational unit hierarchy."
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value ?? 'entities')}>
        <TabsList>
          <TabsTrigger value="entities">Legal entities</TabsTrigger>
          <TabsTrigger value="units">Structure</TabsTrigger>
        </TabsList>
        <TabsContent value="entities">
          <EntitiesTab />
        </TabsContent>
        <TabsContent value="units">
          <UnitsTab entities={entities.data?.items ?? []} />
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
