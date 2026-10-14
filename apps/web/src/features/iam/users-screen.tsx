'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
import { useSession, useCan } from '@/features/auth/session-context';
import { getIam } from '@/features/iam';
import type { UserSummary } from '@/features/iam/iam-types';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ApiRequestError } from '@/lib/api/http-client';
import { CalendarDays, Plus } from 'lucide-react';

const STATUS_VARIANT: Record<
  UserSummary['status'],
  'default' | 'secondary' | 'warning' | 'destructive'
> = {
  ACTIVE: 'default',
  INVITED: 'secondary',
  SUSPENDED: 'warning',
  DISABLED: 'destructive',
};

function humanDate(value: string | null): string {
  if (value === null) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function InviteUserDialog({ onInvited }: { onInvited: () => void }) {
  const repository = getIam();
  const roles = useIamLoad(() => repository.listRoles(), []);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleId, setRoleId] = useState('');
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
        roleIds: roleId ? [roleId] : [],
      });
      setOpen(false);
      setEmail('');
      setDisplayName('');
      setRoleId('');
      onInvited();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The invitation could not be sent.');
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
            Invite user
          </Button>
        }
      />
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            The person receives an invitation email with a link to set their password.
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
            htmlFor="invite-email"
            required
            error={undefined}
            errorId="invite-email-error"
          >
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
          </FormField>
          <FormField
            label="Display name"
            htmlFor="invite-name"
            error={undefined}
            errorId="invite-name-error"
          >
            <Input
              id="invite-name"
              autoComplete="off"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
          </FormField>
          <FormField
            label="Role"
            htmlFor="invite-role"
            error={undefined}
            errorId="invite-role-error"
          >
            <Select
              value={roleId}
              onValueChange={(value) => {
                if (value !== null) {
                  setRoleId(value);
                }
              }}
            >
              <SelectTrigger id="invite-role" className="w-full">
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
          <DialogFooter>
            <FormSubmitButton pending={pending} pendingText="Sending invitation…">
              Send invitation
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusAction({ user, onChange }: { user: UserSummary; onChange: () => void }) {
  const repository = getIam();
  const [pending, setPending] = useState(false);

  const target =
    user.status === 'ACTIVE'
      ? ('SUSPENDED' as const)
      : user.status === 'SUSPENDED'
        ? ('ACTIVE' as const)
        : ('ACTIVE' as const);

  async function apply() {
    setPending(true);
    try {
      await repository.changeUserStatus(user.id, target);
      onChange();
    } finally {
      setPending(false);
    }
  }

  const canManage = useCan('user.update');
  if (!canManage) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || user.status === 'INVITED'}
      onClick={() => void apply()}
    >
      {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
    </Button>
  );
}

export function UsersScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIam();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<UserSummary['status'] | 'ALL'>('ALL');
  const list = useIamLoad(
    () =>
      repository.listUsers(
        { search: debounced || undefined, status: status === 'ALL' ? undefined : status },
        {},
      ),
    [debounced, status],
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Users"
        description="System users and employee accounts."
        actions={<InviteUserDialog onInvited={list.reload} />}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search users"
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as UserSummary['status'] | 'ALL')}
        >
          <SelectTrigger aria-label="Filter by status" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INVITED">Invited</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="DISABLED">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
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
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.displayName}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status]}>{user.status}</Badge>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={role.key} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays aria-hidden="true" className="size-3.5" />
                    {humanDate(user.lastLoginAt)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <StatusAction user={user} onChange={list.reload} />
                </TableCell>
              </TableRow>
            ))}
            {(list.data?.items.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
