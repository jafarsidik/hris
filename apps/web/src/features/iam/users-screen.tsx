'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableBulkAction } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { useToast } from '@/components/ui/toast';
import { useSession, useCan } from '@/features/auth/session-context';
import { getIam } from '@/features/iam';
import type { ManageableUserStatus, UserSummary } from '@/features/iam/iam-types';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { generatePassword } from '@/features/iam/password-generator';
import {
  USER_BUILT_IN_VIEWS,
  USER_SEARCH_TEXT,
  USER_VIEWS_STORAGE_KEY,
  buildUserColumns,
  buildUserFilters,
} from '@/features/iam/user-table-config';
import { UnitPicker } from '@/features/organization/unit-picker';
import { ApiRequestError } from '@/lib/api/http-client';
import { DicesIcon, EyeIcon, EyeOffIcon, Plus, UserCheckIcon, UserXIcon } from 'lucide-react';

/**
 * How many users the screen asks for in one request.
 *
 * The list is small by nature — an administration console for one company's accounts — and
 * the table filters, sorts and pages what it is given, which is how the employee directory
 * works too. Asking for a page of 20 and then filtering it client-side would silently hide
 * the rest of the tenant, so the request is for the whole list and the API's cap decides
 * where it stops.
 */
const USER_PAGE_LIMIT = 100;

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const repository = getIam();
  const roles = useIamLoad(() => repository.listRoles(), []);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      await repository.createUser({
        email,
        displayName,
        password,
        roleIds: roleId ? [roleId] : [],
        organizationalUnitId: unitId,
      });
      setOpen(false);
      setEmail('');
      setDisplayName('');
      setPassword('');
      setRoleId('');
      setUnitId(null);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The user could not be created.');
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
            Add user
          </Button>
        }
      />
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            Creates an active account right away. Share the password with the person; they can
            change it after signing in.
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
            label="Email"
            htmlFor="create-user-email"
            required
            error={undefined}
            errorId="create-user-email-error"
          >
            <Input
              id="create-user-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
          </FormField>
          <FormField
            label="Display name"
            htmlFor="create-user-name"
            error={undefined}
            errorId="create-user-name-error"
          >
            <Input
              id="create-user-name"
              autoComplete="off"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
          </FormField>
          <FormField
            label="Password"
            htmlFor="create-user-password"
            required
            error={undefined}
            errorId="create-user-password-error"
            hint="At least 8 characters with an uppercase letter, a lowercase letter and a digit."
          >
            <div className="flex items-start gap-2">
              <div className="relative flex-1">
                <Input
                  id="create-user-password"
                  type={revealed ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-8"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                />
                {/*
                  A reveal toggle on the field itself, not a global "show passwords" switch:
                  the value is about to be handed to someone else, and mistyping it is the
                  failure this prevents. `aria-pressed` plus a label that changes state means
                  the control says what it does rather than relying on the icon.
                */}
                <button
                  type="button"
                  onClick={() => setRevealed((current) => !current)}
                  aria-label={revealed ? 'Hide password' : 'Show password'}
                  aria-pressed={revealed}
                  className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {revealed ? (
                    <EyeOffIcon aria-hidden="true" className="size-3.5" />
                  ) : (
                    <EyeIcon aria-hidden="true" className="size-3.5" />
                  )}
                </button>
              </div>
              {/*
                Generating also reveals: the administrator has to read the value to pass it
                on, so making that a second click would only be ceremony. The generator
                itself satisfies the policy the hint describes, so the field never arrives
                pre-filled with something the API would reject.
              */}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPassword(generatePassword());
                  setRevealed(true);
                }}
              >
                <DicesIcon aria-hidden="true" className="size-3.5" />
                Generate
              </Button>
            </div>
          </FormField>
          <FormField
            label="Role"
            htmlFor="create-user-role"
            error={undefined}
            errorId="create-user-role-error"
          >
            <Select
              value={roleId}
              onValueChange={(value) => {
                if (value !== null) {
                  setRoleId(value);
                }
              }}
            >
              <SelectTrigger id="create-user-role" className="w-full">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.data?.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Organizational unit"
            htmlFor="create-user-unit"
            error={undefined}
            errorId="create-user-unit-error"
            hint="Optional. Data scopes such as team and department resolve through this placement."
          >
            <UnitPicker id="create-user-unit" value={unitId} onChange={setUnitId} />
          </FormField>
          <DialogFooter>
            <FormSubmitButton pending={pending} pendingText="Creating…">
              Create user
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersScreen() {
  const router = useRouter();
  const { state } = useSession();
  const { toast } = useToast();
  const repository = getIam();
  const canManage = useCan('user.update');

  const list = useIamLoad(() => repository.listUsers({}, { limit: USER_PAGE_LIMIT }), []);

  /*
   * One pending change at a time, whether it came from a row menu or the bulk bar.
   * `SUSPENDED` is routed through the dialog because cutting an account off cannot be
   * undone from this screen by the person doing it; `ACTIVE` is applied straight away,
   * because restoring access is the safe direction and gating it would only add a click.
   */
  const [confirming, setConfirming] = useState<{
    readonly users: readonly UserSummary[];
    readonly target: ManageableUserStatus;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const clearSelection = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  async function applyStatus(
    users: readonly UserSummary[],
    target: ManageableUserStatus,
  ): Promise<void> {
    setPending(true);
    setError(undefined);
    try {
      // Sequential rather than parallel: the API has no bulk endpoint, and a burst of
      // concurrent status writes is a good way to trip a rate limit for no gain.
      for (const user of users) {
        await repository.changeUserStatus(user.id, target);
      }
      const label = target === 'SUSPENDED' ? 'suspended' : 'activated';
      toast({
        title: users.length === 1 ? `Account ${label}` : `${users.length} accounts ${label}`,
        description:
          users.length === 1
            ? `${users[0]?.displayName ?? 'The account'} is now ${target.toLowerCase()}.`
            : `Every selected account is now ${target.toLowerCase()}.`,
        variant: 'success',
      });
      setConfirming(null);
      clearSelection.current?.();
      clearSelection.current = null;
      list.reload();
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : 'The change could not be applied.';
      if (confirming !== null) {
        // Keep the dialog open with the reason, so the reader can retry or back out.
        setError(message);
      } else {
        toast({ title: 'The change could not be applied', description: message, variant: 'error' });
      }
    } finally {
      setPending(false);
    }
  }

  function requestStatus(user: UserSummary): void {
    const target: ManageableUserStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (target === 'ACTIVE') {
      void applyStatus([user], target);
      return;
    }
    setError(undefined);
    setConfirming({ users: [user], target });
  }

  const bulkActions: readonly DataTableBulkAction<UserSummary>[] = canManage
    ? [
        {
          id: 'suspend',
          label: 'Suspend',
          icon: UserXIcon,
          run: (selected, clear) => {
            clearSelection.current = clear;
            setError(undefined);
            setConfirming({ users: selected, target: 'SUSPENDED' });
          },
        },
        {
          id: 'activate',
          label: 'Activate',
          icon: UserCheckIcon,
          run: (selected, clear) => {
            clearSelection.current = clear;
            void applyStatus(selected, 'ACTIVE');
          },
        },
      ]
    : [];

  const rows = list.data?.items ?? [];
  const single = confirming?.users.length === 1 ? confirming.users[0] : undefined;

  return (
    <PageBody>
      <PageHeader
        title="Users"
        description="System users and employee accounts."
        actions={<CreateUserDialog onCreated={list.reload} />}
      />

      <HrisDataTable
        rows={rows}
        columns={buildUserColumns(canManage ? { onChangeStatus: requestStatus } : {})}
        filters={buildUserFilters(rows)}
        searchable
        searchText={USER_SEARCH_TEXT}
        searchPlaceholder="Search by name, email, unit or role…"
        selectable={canManage}
        bulkActions={bulkActions}
        views={{ builtIn: USER_BUILT_IN_VIEWS, storageKey: USER_VIEWS_STORAGE_KEY }}
        status={list.loading ? 'loading' : list.error !== undefined ? 'error' : 'ready'}
        errorCopy={list.error}
        onRetry={list.reload}
        emptyTitle="No users yet"
        emptyDescription="Accounts created here, and employees given a login, appear in this list."
        noResultsTitle="No users match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every account."
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
            setError(undefined);
          }
        }}
        title={
          single !== undefined
            ? `Suspend ${single.displayName}?`
            : `Suspend ${confirming?.users.length ?? 0} accounts?`
        }
        description={
          single !== undefined ? (
            <>
              {single.email} keeps its data, roles and history, but cannot sign in until the account
              is activated again. Sessions that are already open end at their next request.
            </>
          ) : (
            <>
              Every selected account keeps its data, roles and history, but none of them can sign in
              until they are activated again.
            </>
          )
        }
        confirmLabel="Suspend"
        tone="destructive"
        pending={pending}
        error={error}
        onConfirm={() => {
          if (confirming !== null) {
            void applyStatus(confirming.users, confirming.target);
          }
        }}
      />
    </PageBody>
  );
}
