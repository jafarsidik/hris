'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { KvItem } from '@/features/employee-detail/payroll-panel';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';

import type { AccountSample } from './profile-extras';

interface SecuritySetting {
  readonly label: string;
  readonly description: string;
  readonly defaultChecked: boolean;
  readonly enabledMessage: string;
  readonly disabledMessage: string;
}

const SECURITY_SETTINGS: readonly SecuritySetting[] = [
  {
    label: 'Two-factor verification',
    description: 'Ask for a code from an authenticator app at sign-in.',
    defaultChecked: true,
    enabledMessage: 'Two-factor verification enabled.',
    disabledMessage: 'Two-factor verification disabled.',
  },
  {
    label: 'New-device sign-in alerts',
    description: 'Send an email whenever a new device signs in.',
    defaultChecked: true,
    enabledMessage: 'New-device alerts enabled.',
    disabledMessage: 'New-device alerts disabled.',
  },
  {
    label: 'Mobile app access',
    description: 'Allow attendance and leave requests from the mobile app.',
    defaultChecked: false,
    enabledMessage: 'Mobile app access enabled.',
    disabledMessage: 'Mobile app access disabled.',
  },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The account panel body: the employee's user account plus its security
 * switches.
 *
 * When no account exists yet the panel opens straight into a create form —
 * once saved the account shows in read mode with an edit affordance. Saving
 * stays local (the IAM module owns real accounts), mirroring how the rest of
 * the profile's sample screens behave.
 */
export function AccountPanel({ account: initial }: { account: AccountSample | null }) {
  const { toast } = useToast();
  const [account, setAccount] = React.useState<AccountSample | null>(initial);
  const [editing, setEditing] = React.useState<boolean>(initial === null);
  const [checks, setChecks] = React.useState<boolean[]>(
    SECURITY_SETTINGS.map((setting) => setting.defaultChecked === true),
  );

  const toggle = (index: number, next: boolean) => {
    setChecks((current) => current.map((value, i) => (i === index ? next : value)));
    const setting = SECURITY_SETTINGS[index];
    toast({
      title: next
        ? (setting?.enabledMessage ?? 'Setting enabled.')
        : (setting?.disabledMessage ?? 'Setting disabled.'),
    });
  };

  const notify = (title: string, description: string) => {
    toast({ title, description });
  };

  if (account === null) {
    if (!editing) {
      return (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-4 text-base font-semibold">User account</h2>
            <div className="rounded-lg bg-muted/50 p-6 text-center">
              <p className="text-sm font-medium">No user account yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This employee cannot sign in until an account is created.
              </p>
              <Button type="button" size="sm" className="mt-4" onClick={() => setEditing(true)}>
                Create account
              </Button>
            </div>
          </section>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-5">
        <AccountForm
          title="Create account"
          description="An invitation email sets the first password — nothing is stored here yet."
          submitLabel="Create account"
          existing={null}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            setAccount(next);
            setEditing(false);
            notify('Account created', 'Sample only — the IAM module will own real accounts.');
          }}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-5">
        <AccountForm
          title="Edit account"
          description="Changes apply to the sample record in this panel only."
          submitLabel="Save changes"
          existing={account}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            setAccount(next);
            setEditing(false);
            notify('Account updated', 'Sample only — the IAM module will own real accounts.');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="mb-4 flex items-center justify-between gap-12">
          <h2 className="text-base font-semibold">User account</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit account
          </Button>
        </div>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <KvItem label="Username">{account.username}</KvItem>
          <KvItem label="Login email">{account.email}</KvItem>
          <KvItem label="Roles">{account.roles}</KvItem>
          <KvItem label="Account status">
            <Badge variant="success">{account.accountStatus}</Badge>
          </KvItem>
          <KvItem label="Last sign-in">{account.lastLogin}</KvItem>
          <KvItem label="Password changed">{account.passwordChanged}</KvItem>
        </dl>
      </section>

      <section className="border-t border-border pt-5">
        <h2 className="mb-4 text-base font-semibold">Security</h2>
        <div className="flex flex-col">
          {SECURITY_SETTINGS.map((setting, index) => (
            <div
              key={setting.label}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-3.5 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">{setting.label}</div>
                <div className="text-xs text-muted-foreground">{setting.description}</div>
              </div>
              <Switch
                checked={checks[index] === true}
                onCheckedChange={(value) => toggle(index, value === true)}
                aria-label={setting.label}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border pt-5">
        <div className="flex max-w-md flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              notify('Password reset link sent', 'Sent to the employee’s login email.')
            }
          >
            Reset password
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-destructive"
            onClick={() => {
              setAccount(null);
              setEditing(false);
              notify('Account deactivated', 'Removed from this session’s sample data.');
            }}
          >
            Deactivate account
          </Button>
        </div>
      </section>
    </div>
  );
}

interface AccountFormProps {
  readonly title: string;
  readonly description: string;
  readonly submitLabel: string;
  readonly existing: AccountSample | null;
  readonly onCancel: () => void;
  readonly onSave: (account: AccountSample) => void;
}

/**
 * The shared create/edit account form. Validation is deliberately shallow
 * (required fields plus an email shape); the real IAM integration will own
 * uniqueness and password policy.
 */
function AccountForm({
  title,
  description,
  submitLabel,
  existing,
  onCancel,
  onSave,
}: AccountFormProps) {
  const [username, setUsername] = React.useState<string>(existing?.username ?? '');
  const [email, setEmail] = React.useState<string>(existing?.email ?? '');
  const [roles, setRoles] = React.useState<string>(existing?.roles ?? 'Employee');
  const [error, setError] = React.useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    if (trimmedUsername === '' || trimmedEmail === '') {
      setError('Username and login email are required.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('The login email does not look like an email address.');
      return;
    }
    setError(null);
    onSave({
      username: trimmedUsername,
      email: trimmedEmail,
      roles: roles.trim() === '' ? 'Employee' : roles.trim(),
      accountStatus: existing?.accountStatus ?? 'Active',
      lastLogin: existing?.lastLogin ?? 'Never',
      passwordChanged: existing?.passwordChanged ?? '—',
    });
  };

  return (
    <form onSubmit={submit}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt>
            <label htmlFor="account-username" className="text-xs text-muted-foreground">
              Username <span aria-hidden="true">*</span>
            </label>
          </dt>
          <dd className="mt-1.5">
            <Input
              id="account-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rizky.pratama"
              autoComplete="off"
            />
          </dd>
        </div>
        <div>
          <dt>
            <label htmlFor="account-email" className="text-xs text-muted-foreground">
              Login email <span aria-hidden="true">*</span>
            </label>
          </dt>
          <dd className="mt-1.5">
            <Input
              id="account-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.co.id"
              autoComplete="off"
            />
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt>
            <label htmlFor="account-roles" className="text-xs text-muted-foreground">
              Roles (comma separated)
            </label>
          </dt>
          <dd className="mt-1.5">
            <Input
              id="account-roles"
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              placeholder="Employee, Leave Approver"
              autoComplete="off"
            />
          </dd>
        </div>
      </dl>

      {error !== null && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
