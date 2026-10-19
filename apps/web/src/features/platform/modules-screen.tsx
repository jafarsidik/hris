'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus } from 'lucide-react';

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
function ModuleForm({
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

  return (
    <PageBody>
      <PageHeader
        title="Module Registry"
        description="Modules owned by each application — the functional areas that register resources."
      />
      {applications.loading || modules.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Modules</CardTitle>
                <CardDescription>
                  {moduleRows.length} module{moduleRows.length === 1 ? '' : 's'} across{' '}
                  {appRows.length} application{appRows.length === 1 ? '' : 's'}
                </CardDescription>
              </div>
              <DialogTrigger
                render={
                  <Button disabled={!canManage || applications.loading || modules.loading}>
                    <Plus className="mr-1 size-4" />
                    Register module
                  </Button>
                }
              />
            </div>
          </CardHeader>
          <CardContent>
            {moduleRows.length === 0 ? (
              <EmptyState title="No modules are registered yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleRows.map((module: ModuleSummary) => {
                    const application = appRows.find((a) => a.id === module.applicationId);
                    return (
                      <TableRow key={module.id}>
                        <TableCell className="font-mono text-sm">{module.key}</TableCell>
                        <TableCell className="font-medium">{module.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {application?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={module.isActive ? 'success' : 'secondary'}>
                            {module.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManage && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditing(module);
                                  setOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <ModuleForm
        open={open}
        onOpenChange={setOpen}
        module={editing}
        applications={appRows}
        onSaved={() => {
          modules.reload();
          applications.reload();
          setEditing(null);
        }}
      />
    </PageBody>
  );
}
