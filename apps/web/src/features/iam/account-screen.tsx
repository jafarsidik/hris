'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { changePassword, revokeOtherSessions } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';
import { CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react';

export function AccountScreen() {
  const router = useRouter();
  const { state, refresh } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [changed, setChanged] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  if (state.status !== 'authenticated') {
    return null;
  }

  const user = state.session.user;

  async function submit() {
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError(undefined);
    setChanged(false);
    try {
      await changePassword({ currentPassword, newPassword });
      setChanged(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Your password could not be changed.',
      );
    } finally {
      setPending(false);
    }
  }

  async function signOutEverywhere() {
    setRevoking(true);
    setError(undefined);
    try {
      await revokeOtherSessions();
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Other sessions could not be signed out.',
      );
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="My Account" description="Your profile and authentication details." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Who you are in this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium">{user.displayName || user.email}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{user.status}</Badge>
            {user.hasVerifiedEmail ? (
              <Badge variant="secondary">Email verified</Badge>
            ) : (
              <Badge variant="secondary">Email not verified</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role.key} variant="outline">
                {role.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <KeyRound aria-hidden="true" className="size-4" />
              Change password
            </span>
          </CardTitle>
          <CardDescription>Update the password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            noValidate
          >
            {error !== undefined && <FormErrorSummary>{error}</FormErrorSummary>}
            {changed && (
              <Alert variant="success">
                <CheckCircle2 aria-hidden="true" />
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>
                  Use your new password the next time you sign in.
                </AlertDescription>
              </Alert>
            )}
            <FormField
              label="Current password"
              htmlFor="account-current-password"
              required
              error={undefined}
              errorId="account-current-password-error"
            >
              <Input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                required
              />
            </FormField>
            <FormField
              label="New password"
              htmlFor="account-new-password"
              required
              error={undefined}
              errorId="account-new-password-error"
            >
              <Input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                required
              />
            </FormField>
            <FormField
              label="Confirm new password"
              htmlFor="account-confirm-password"
              required
              error={undefined}
              errorId="account-confirm-password-error"
            >
              <Input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.currentTarget.value)}
                required
              />
            </FormField>
            <div>
              <FormSubmitButton pending={pending} pendingText="Updating…">
                Update password
              </FormSubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <ShieldAlert aria-hidden="true" className="size-4" />
              Sessions
            </span>
          </CardTitle>
          <CardDescription>
            Sign out every other device. The current session stays signed in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled={revoking} onClick={() => void signOutEverywhere()}>
            {revoking ? 'Signing out other sessions…' : 'Sign out other sessions'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
