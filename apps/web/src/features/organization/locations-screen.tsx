'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type {
  CreateWorkLocationInput,
  Paginated,
  UpdateWorkLocationInput,
  WorkLocationSummary,
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { apiRequestV1 } from '@/lib/api/client-config';
import { ApiRequestError } from '@/lib/api/http-client';
import { MoreHorizontalIcon, Pencil, Plus, Trash2 } from 'lucide-react';

/**
 * Work locations: the offices and sites attendance and payroll are tied to.
 *
 * Reads and writes the API rather than a fixed list, so a location adds itself to every
 * picker that draws from this table.
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

const listLocations = (): Promise<Paginated<WorkLocationSummary>> =>
  apiRequestV1<Paginated<WorkLocationSummary>>('/organization/locations?limit=100');

const createLocation = (input: CreateWorkLocationInput): Promise<WorkLocationSummary> =>
  apiRequestV1<WorkLocationSummary>('/organization/locations', { method: 'POST', body: input });

const updateLocation = (id: string, input: UpdateWorkLocationInput): Promise<WorkLocationSummary> =>
  apiRequestV1<WorkLocationSummary>(`/organization/locations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });

const deleteLocation = (id: string): Promise<void> =>
  apiRequestV1<void>(`/organization/locations/${encodeURIComponent(id)}`, { method: 'DELETE' });

function LocationRowMenu({
  location,
  onEdit,
  onDelete,
}: {
  readonly location: WorkLocationSummary;
  readonly onEdit: (location: WorkLocationSummary) => void;
  readonly onDelete: (location: WorkLocationSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${location.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onEdit(location)}>
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(location)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface LocationFormState {
  code: string;
  name: string;
  city: string;
  country: string;
  address: string;
  timezone: string;
  isHeadquarters: boolean;
}

function stateFromLocation(location: WorkLocationSummary | null): LocationFormState {
  return {
    code: location?.code ?? '',
    name: location?.name ?? '',
    city: location?.city ?? '',
    country: location?.country ?? '',
    address: location?.address ?? '',
    timezone: location?.timezone ?? '',
    isHeadquarters: location?.isHeadquarters ?? false,
  };
}

const nullable = (value: string): string | null => (value.trim() === '' ? null : value.trim());

function LocationDialog({
  open,
  onOpenChange,
  location,
  onSaved,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly location: WorkLocationSummary | null;
  readonly onSaved: () => void;
}) {
  const [form, setForm] = useState<LocationFormState>(() => stateFromLocation(location));
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(stateFromLocation(location));
      setError(undefined);
    }
  }, [open, location]);

  async function submit(): Promise<void> {
    setPending(true);
    setError(undefined);
    try {
      const input = {
        code: form.code.trim(),
        name: form.name.trim(),
        city: nullable(form.city),
        country: nullable(form.country),
        address: nullable(form.address),
        timezone: nullable(form.timezone),
        isHeadquarters: form.isHeadquarters,
      };
      if (location === null) {
        await createLocation(input);
      } else {
        await updateLocation(location.id, input);
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
          <DialogTitle>{location === null ? 'Add a location' : 'Edit location'}</DialogTitle>
          <DialogDescription>
            Offices and sites. One location can be marked as headquarters.
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
            <FormField label="Code" htmlFor="location-code" required errorId="location-code-error">
              <Input
                id="location-code"
                value={form.code}
                placeholder="HQ-JKT"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, code: value }));
                }}
              />
            </FormField>
            <FormField label="Name" htmlFor="location-name" required errorId="location-name-error">
              <Input
                id="location-name"
                value={form.name}
                placeholder="Jakarta Headquarters"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, name: value }));
                }}
              />
            </FormField>
            <FormField label="City" htmlFor="location-city" errorId="location-city-error">
              <Input
                id="location-city"
                value={form.city}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, city: value }));
                }}
              />
            </FormField>
            <FormField label="Country" htmlFor="location-country" errorId="location-country-error">
              <Input
                id="location-country"
                value={form.country}
                placeholder="ID"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, country: value }));
                }}
              />
            </FormField>
          </div>
          <FormField label="Address" htmlFor="location-address" errorId="location-address-error">
            <Input
              id="location-address"
              value={form.address}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, address: value }));
              }}
            />
          </FormField>
          <FormField label="Timezone" htmlFor="location-timezone" errorId="location-timezone-error">
            <Input
              id="location-timezone"
              value={form.timezone}
              placeholder="Asia/Jakarta"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setForm((current) => ({ ...current, timezone: value }));
              }}
            />
          </FormField>
          <div className="flex items-center gap-3">
            <Switch
              id="location-hq"
              checked={form.isHeadquarters}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, isHeadquarters: checked === true }))
              }
            />
            <Label htmlFor="location-hq">Headquarters</Label>
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
              {location === null ? 'Add location' : 'Save changes'}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const canCreate = useCan('organization.create');
  const canUpdate = useCan('organization.update');
  const canDelete = useCan('organization.delete');

  const locations = useIamLoad(listLocations, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLocationSummary | null>(null);
  const [deleting, setDeleting] = useState<WorkLocationSummary | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = locations.data?.items ?? [];

  async function confirmDelete(): Promise<void> {
    if (deleting === null) return;
    setDeletePending(true);
    setDeleteError(undefined);
    try {
      await deleteLocation(deleting.id);
      toast({
        title: 'Location deleted',
        description: `${deleting.name} has been removed.`,
        variant: 'success',
      });
      setDeleting(null);
      locations.reload();
    } catch (err) {
      setDeleteError(messageOf(err));
    } finally {
      setDeletePending(false);
    }
  }

  const columns: readonly DataTableColumn<WorkLocationSummary>[] = [
    {
      id: 'code',
      header: 'Code',
      sortValue: (location) => location.code,
      cellClassName: 'font-mono text-xs',
      cell: (location) => location.code,
    },
    {
      id: 'name',
      header: 'Location',
      sortValue: (location) => location.name,
      cellClassName: 'font-medium',
      cell: (location) => (
        <span className="flex items-center gap-2">
          {location.name}
          {location.isHeadquarters && <Badge variant="secondary">HQ</Badge>}
        </span>
      ),
    },
    {
      id: 'city',
      header: 'City',
      sortValue: (location) => location.city ?? '',
      cell: (location) => location.city ?? '—',
    },
    {
      id: 'country',
      header: 'Country',
      sortValue: (location) => location.country ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (location) => location.country ?? '—',
    },
    {
      id: 'timezone',
      header: 'Timezone',
      sortValue: (location) => location.timezone ?? '',
      cellClassName: 'text-muted-foreground',
      cell: (location) => location.timezone ?? '—',
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (location) =>
        canUpdate || canDelete ? (
          <LocationRowMenu
            location={location}
            onEdit={(target) => {
              setEditing(target);
              setDialogOpen(true);
            }}
            onDelete={(target) => setDeleting(target)}
          />
        ) : null,
    },
  ];

  const filters: readonly DataTableFilter<WorkLocationSummary>[] = [
    {
      kind: 'select',
      id: 'city',
      label: 'City',
      placeholder: 'All cities',
      getValue: (location) => location.city ?? '',
      options: [
        ...new Set(rows.map((location) => location.city).filter((city) => city !== null)),
      ].map((city) => ({ value: city, label: city })),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Locations"
        description="Offices and sites — the places attendance and payroll are tied to."
      />
      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchable
        searchText={(location) => `${location.code} ${location.name} ${location.city ?? ''}`}
        searchPlaceholder="Search locations"
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
              Add location
            </Button>
          ) : undefined
        }
        status={locations.loading ? 'loading' : locations.error !== undefined ? 'error' : 'ready'}
        errorCopy={locations.error}
        onRetry={() => locations.reload()}
        emptyTitle="No locations yet"
        emptyDescription="Add an office or site to place employees and attendance records."
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
              Add location
            </Button>
          ) : undefined
        }
        noResultsTitle="No locations match this filter"
        noResultsDescription="Try a different search or clear the filters to see every location."
      />

      <LocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        location={editing}
        onSaved={locations.reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(undefined);
          }
        }}
        title={`Delete ${deleting?.name ?? 'this location'}?`}
        description={`Delete "${deleting?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete location"
        tone="destructive"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
      />
    </PageBody>
  );
}
