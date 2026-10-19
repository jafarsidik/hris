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
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly application: ApplicationSummary | null;
  readonly onSaved: () => void;
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
          <Button variant="outline" size="sm">
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Applications</CardTitle>
              <CardDescription>
                {applications.loading
                  ? 'Loading…'
                  : `${rows.length} application${rows.length === 1 ? '' : 's'}`}
              </CardDescription>
            </div>
            <DialogTrigger
              render={
                <Button disabled={!canManage || applications.loading}>
                  <Plus className="mr-1 size-4" />
                  Register application
                </Button>
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          {applications.loading && rows.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No applications are registered yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((application: ApplicationSummary) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-mono text-sm">{application.key}</TableCell>
                    <TableCell className="font-medium">{application.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {application.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={application.isActive ? 'success' : 'secondary'}>
                        {application.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={applications.loading}
                            onClick={() => {
                              setEditing(application);
                              setOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ApplicationForm
        open={open}
        onOpenChange={setOpen}
        application={editing}
        onSaved={() => {
          applications.reload();
          setEditing(null);
        }}
      />
    </PageBody>
  );
}
