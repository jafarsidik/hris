'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { DATA_SCOPES, type DataScope } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

import { useSession } from '@/features/auth/session-context';
import { getIam } from '@/features/iam';
import type { PermissionGrantInput } from '@/features/iam/iam-types';
import {
  grantsToMap,
  groupMatrixByModule,
  hasGrant,
  mapToGrants,
  scopeFor,
  setGrantScope,
  toMatrixResources,
  toggleGrant,
} from '@/features/iam/permission-matrix';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';
import { Plus, Shield, Trash2 } from 'lucide-react';

function NewRoleDialog({ onChanged }: { onChanged: () => void }) {
  const repository = getIam();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      await repository.createRole({ key, name, description });
      setOpen(false);
      setKey('');
      setName('');
      setDescription('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The role could not be created.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default">
            <Plus aria-hidden="true" className="size-4" />
            New role
          </Button>
        }
      />
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create a role</DialogTitle>
          <DialogDescription>
            A role is a named set of permissions that can be granted to users.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
          <FormField
            label="Key"
            htmlFor="role-key"
            required
            error={undefined}
            errorId="role-key-error"
            hint="Uppercase identifier, e.g. PAYROLL_OFFICER."
          >
            <Input
              id="role-key"
              value={key}
              onChange={(event) => setKey(event.currentTarget.value.toUpperCase())}
              required
            />
          </FormField>
          <FormField
            label="Name"
            htmlFor="role-name"
            required
            error={undefined}
            errorId="role-name-error"
          >
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              required
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="role-description"
            required={false}
            error={undefined}
            errorId="role-description-error"
          >
            <Input
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </FormField>
          <DialogFooter>
            <FormSubmitButton pending={pending}>Create role</FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScopeSelect({
  value,
  onValueChange,
  label,
}: {
  value: DataScope;
  onValueChange: (scope: DataScope) => void;
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) {
          onValueChange(next as DataScope);
        }
      }}
    >
      <SelectTrigger className="h-7 w-full text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DATA_SCOPES.map((scope) => (
          <SelectItem key={scope} value={scope}>
            {scope}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const humanise = (value: string): string =>
  value.length === 0 ? value : `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;

/**
 * Edits a role's grants as a `resource × action × scope` matrix.
 *
 * The rows and columns come from the platform registry (`GET /platform/registry/resources`),
 * not a hardcoded frontend table, so a newly registered resource appears here without a
 * web change. A cell is enabled or disabled by toggling its checkbox; enabling it applies
 * the default scope, which the inline selector then narrows.
 */
function RoleDetailScreen({
  roleId,
  open,
  onOpenChange,
  onChanged,
}: {
  roleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const repository = getIam();
  const detail = useIamLoad(
    () => (roleId === null ? Promise.resolve(null) : repository.getRole(roleId)),
    [roleId],
  );
  const resources = useIamLoad(() => platformApi.listRegistryResources(), []);
  const modules = useIamLoad(() => platformApi.listRegistryModules(), []);

  const [grants, setGrants] = useState<ReadonlyMap<string, PermissionGrantInput>>(new Map());
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (detail.data !== null) {
      setGrants(
        grantsToMap(
          detail.data.grants.map((grant) => ({
            resource: grant.resource,
            action: grant.action,
            scope: grant.scope,
            scopeId: grant.scopeId ?? undefined,
          })),
        ),
      );
    }
  }, [detail.data]);

  const groups = useMemo(
    () =>
      groupMatrixByModule(
        toMatrixResources(resources.data ?? []),
        (modules.data ?? []).map((module) => ({ key: module.key, name: module.name })),
      ),
    [resources.data, modules.data],
  );

  const actionLabels = useMemo(() => {
    const labels = new Map<string, string>();
    (resources.data ?? []).forEach((resource) =>
      resource.actions.forEach((action) => labels.set(action.action, action.name)),
    );
    return labels;
  }, [resources.data]);

  const loading = detail.loading || resources.loading || modules.loading;

  async function save() {
    if (roleId === null) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await repository.replaceRolePermissions(roleId, mapToGrants(grants));
      onOpenChange(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Permissions could not be saved.');
    } finally {
      setPending(false);
    }
  }

  async function removeRole() {
    if (roleId === null) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await repository.deleteRole(roleId);
      onOpenChange(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The role could not be deleted.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open && roleId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {detail.data ? (
              <>
                {detail.data.name}
                {detail.data.isSystem && (
                  <Badge variant="secondary" className="ml-2">
                    System
                  </Badge>
                )}
              </>
            ) : (
              'Role'
            )}
          </DialogTitle>
          <DialogDescription>
            {detail.data?.description ?? 'Loading role…'}
            {detail.data ? ` — ${grants.size} permission${grants.size === 1 ? '' : 's'}.` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : groups.length === 0 ? (
          <EmptyState title="No resources are registered" />
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            {groups.map((group) => (
              <div key={group.key ?? 'unassigned'} className="mb-6 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{group.name}</span>
                  <Badge variant="outline">{group.resources.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-40">Resource</TableHead>
                      {group.columns.map((column) => (
                        <TableHead key={column} className="text-center">
                          {actionLabels.get(column) ?? humanise(column)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.resources.map((resource) => (
                      <TableRow key={resource.key}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{resource.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {resource.key}
                            </span>
                          </div>
                        </TableCell>
                        {group.columns.map((column) => {
                          const supported = resource.actions.some(
                            (action) => action.action === column,
                          );
                          if (!supported) {
                            return (
                              <TableCell
                                key={column}
                                className="text-center text-muted-foreground"
                                aria-hidden="true"
                              >
                                ·
                              </TableCell>
                            );
                          }
                          const enabled = hasGrant(grants, resource.key, column);
                          const scope = scopeFor(grants, resource.key, column);
                          return (
                            <TableCell key={column} className="align-top">
                              <div className="flex flex-col items-center gap-1">
                                <Checkbox
                                  checked={enabled}
                                  onCheckedChange={() =>
                                    setGrants((current) =>
                                      toggleGrant(current, resource.key, column),
                                    )
                                  }
                                  aria-label={`${enabled ? 'Revoke' : 'Grant'} ${resource.key} ${column}`}
                                />
                                {enabled && scope !== null && (
                                  <div className="w-28">
                                    <ScopeSelect
                                      value={scope}
                                      onValueChange={(next) =>
                                        setGrants((current) =>
                                          setGrantScope(current, resource.key, column, next),
                                        )
                                      }
                                      label={`${resource.key} ${column} scope`}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}

        {(resources.error ?? modules.error) !== undefined && (
          <FormErrorSummary>{resources.error ?? modules.error}</FormErrorSummary>
        )}
        {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}

        <DialogFooter className="justify-between">
          <div>
            {detail.data !== null && !detail.data?.isSystem && (
              <Button variant="destructive" disabled={pending} onClick={() => void removeRole()}>
                <Trash2 aria-hidden="true" className="size-4" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <FormSubmitButton pending={pending} onClick={() => void save()}>
              Save permissions
            </FormSubmitButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIam();
  const list = useIamLoad(() => repository.listRoles(), []);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader
        title="Roles"
        description="Role definitions and access profiles."
        actions={<NewRoleDialog onChanged={list.reload} />}
      />
      <RoleDetailScreen
        roleId={openRoleId}
        open={openRoleId !== null}
        onOpenChange={() => setOpenRoleId(null)}
        onChanged={list.reload}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead className="text-right">Permissions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.data?.map((role) => (
            <TableRow
              key={role.id}
              className="cursor-pointer"
              onClick={() => setOpenRoleId(role.id)}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{role.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{role.key}</span>
                </div>
              </TableCell>
              <TableCell>
                {role.isSystem ? (
                  <Badge variant="secondary">
                    <Shield aria-hidden="true" className="size-3" />
                    System
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Custom</span>
                )}
              </TableCell>
              <TableCell className="text-right">{role.memberCount}</TableCell>
              <TableCell className="text-right">{role.permissionCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!list.loading && (list.data?.length ?? 0) === 0 && (
        <EmptyState
          title="No roles are defined yet"
          description="Create a role to group permissions and assign them to users."
        />
      )}
      {list.error !== undefined && (
        <p className="text-sm text-destructive" role="alert">
          {list.error}
        </p>
      )}
    </PageBody>
  );
}
