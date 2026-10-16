'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  ORGANIZATIONAL_UNIT_TYPES,
  type OrganizationalUnitSummary,
  type OrganizationalUnitType,
  type OrganizationEntitySummary,
} from '@hris/shared-types';

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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ApiRequestError } from '@/lib/api/http-client';
import { Plus } from 'lucide-react';

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

function Notice({ message }: { readonly message: string | undefined }) {
  if (message === undefined) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Confirms a destructive action in a dialog and surfaces whatever the API rejects with. */
function ConfirmDelete({
  label,
  description,
  onConfirm,
}: {
  readonly label: string;
  readonly description: string;
  readonly onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(undefined);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            {label}
          </Button>
        }
      />
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
            {pending ? 'Deleting…' : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const canUpdate = useCan('organization.update');
  const canDelete = useCan('organization.delete');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationEntitySummary | null>(null);
  const [notice, setNotice] = useState<string | undefined>();

  const list = useIamLoad(
    () => repository.listEntities({ search: debounced || undefined }, {}),
    [debounced],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  function openCreate() {
    setEditing(null);
    setNotice(undefined);
    setDialogOpen(true);
  }

  function openEdit(entity: OrganizationEntitySummary) {
    setEditing(entity);
    setNotice(undefined);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          aria-label="Search entities"
          placeholder="Search entities"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="max-w-xs"
        />
        {canCreate && (
          <Button variant="default" onClick={openCreate}>
            <Plus aria-hidden="true" className="size-4" />
            Add entity
          </Button>
        )}
      </div>

      <Notice message={notice} />

      {list.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((entity) => (
              <TableRow key={entity.id}>
                <TableCell className="font-mono text-xs">{entity.code}</TableCell>
                <TableCell className="font-medium">{entity.name}</TableCell>
                <TableCell>{entity.countryCode}</TableCell>
                <TableCell>{entity.currencyCode}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  {canUpdate && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(entity)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <ConfirmDelete
                      label="Delete"
                      description={`Delete "${entity.name}"? This cannot be undone.`}
                      onConfirm={async () => {
                        await repository.deleteEntity(entity.id);
                        setNotice(undefined);
                        list.reload();
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(list.data?.items.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No legal entities yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entity={editing}
        onSaved={list.reload}
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

function stateFromUnit(unit: OrganizationalUnitSummary | null): UnitFormState {
  return {
    code: unit?.code ?? '',
    name: unit?.name ?? '',
    type: unit?.type ?? 'DEPARTMENT',
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
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly unit: OrganizationalUnitSummary | null;
  readonly entities: readonly OrganizationEntitySummary[];
  readonly units: readonly OrganizationalUnitSummary[];
  readonly onSaved: () => void;
}) {
  const repository = getOrganization();
  const [form, setForm] = useState<UnitFormState>(() => stateFromUnit(unit));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(stateFromUnit(unit));
      setError(undefined);
    }
  }, [open, unit]);

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

function UnitsTab({ entities }: { readonly entities: readonly OrganizationEntitySummary[] }) {
  const repository = getOrganization();
  const canCreate = useCan('organization.create');
  const canUpdate = useCan('organization.update');
  const canDelete = useCan('organization.delete');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>(NONE);
  const [typeFilter, setTypeFilter] = useState<string>(NONE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationalUnitSummary | null>(null);

  const list = useIamLoad(
    () =>
      repository.listUnits(
        {
          search: debounced || undefined,
          entityId: entityFilter === NONE ? undefined : entityFilter,
          type: typeFilter === NONE ? undefined : (typeFilter as OrganizationalUnitType),
        },
        { limit: 100 },
      ),
    [debounced, entityFilter, typeFilter],
  );

  const units = list.data?.items ?? [];
  const nameOf = (id: string | null): string => {
    if (id === null) {
      return '—';
    }
    return units.find((unit) => unit.id === id)?.name ?? id;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(unit: OrganizationalUnitSummary) {
    setEditing(unit);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search units"
          placeholder="Search units"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="max-w-xs"
        />
        <Select value={entityFilter} onValueChange={(value) => setEntityFilter(value ?? NONE)}>
          <SelectTrigger aria-label="Filter by entity" className="w-52">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All entities</SelectItem>
            {entities.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>
                {entity.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? NONE)}>
          <SelectTrigger aria-label="Filter by type" className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All types</SelectItem>
            {ORGANIZATIONAL_UNIT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button variant="default" className="ml-auto" onClick={openCreate}>
            <Plus aria-hidden="true" className="size-4" />
            Add unit
          </Button>
        )}
      </div>

      {list.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-mono text-xs">{unit.code}</TableCell>
                <TableCell className="font-medium">{unit.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{unit.type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{nameOf(unit.parentId)}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  {canUpdate && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(unit)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <ConfirmDelete
                      label="Delete"
                      description={`Delete "${unit.name}"? This cannot be undone.`}
                      onConfirm={async () => {
                        await repository.deleteUnit(unit.id);
                        list.reload();
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {units.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No organizational units yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <UnitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        unit={editing}
        entities={entities}
        units={units}
        onSaved={list.reload}
      />
    </div>
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
