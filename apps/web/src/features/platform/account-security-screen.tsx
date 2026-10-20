'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';

import type { PasskeySummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi, type MfaEnrollment } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

function messageFrom(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Something went wrong. Please retry.';
}

/**
 * Sign-in security for the signed-in user: a TOTP authenticator and passkeys.
 *
 * Both are self-service, so the screen only requires a session. Enrollment is shown
 * exactly once — the TOTP secret and recovery codes never come back from the API.
 */
export function AccountSecurityScreen() {
  const router = useRouter();
  const { state } = useSession();

  const status = useIamLoad(() => platformApi.mfaStatus(), []);
  const passkeys = useIamLoad(() => platformApi.listPasskeys(), []);

  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[] | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const beginEnrollment = useCallback(async () => {
    setError(undefined);
    setPending(true);
    try {
      setEnrollment(await platformApi.mfaEnroll());
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setPending(false);
    }
  }, []);

  const confirmEnrollment = useCallback(async () => {
    if (enrollment === null) {
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const result = await platformApi.mfaConfirm(enrollment.factorId, code);
      setRecoveryCodes(result.codes);
      setEnrollment(null);
      setCode('');
      status.reload();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setPending(false);
    }
  }, [enrollment, code, status]);

  const disableMfa = useCallback(async () => {
    setError(undefined);
    setPending(true);
    try {
      await platformApi.mfaDisable();
      setRecoveryCodes(null);
      status.reload();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setPending(false);
    }
  }, [status]);

  const addPasskey = useCallback(async () => {
    setError(undefined);
    setPending(true);
    try {
      const options = (await platformApi.passkeyRegistrationOptions()) as never;
      const response = await startRegistration({ optionsJSON: options });
      await platformApi.passkeyRegistrationVerify(response, deviceName || undefined);
      setDeviceName('');
      passkeys.reload();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setPending(false);
    }
  }, [deviceName, passkeys]);

  const removePasskey = useCallback(
    async (id: string) => {
      setError(undefined);
      try {
        await platformApi.deletePasskey(id);
        passkeys.reload();
      } catch (cause) {
        setError(messageFrom(cause));
      }
    },
    [passkeys],
  );

  return (
    <PageBody>
      <PageHeader
        title="Sign-in security"
        description="Add a second factor and passkeys to protect your account."
      />

      {error !== undefined && <ErrorPanel error={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Authenticator app</CardTitle>
          <CardDescription>
            Use a TOTP app such as Google Authenticator or 1Password.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status.loading ? (
            <Skeleton className="h-9 w-48" />
          ) : recoveryCodes !== null ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Save these recovery codes. They are shown only once.
              </p>
              <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                {recoveryCodes.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
            </div>
          ) : enrollment !== null ? (
            <div className="flex flex-col gap-3">
              {/* The QR is a data URL produced by the API; no binary asset is fetched. */}
              <img
                src={enrollment.qrDataUrl}
                alt="Authenticator QR code"
                className="h-40 w-40 self-start rounded border border-border"
              />
              <p className="text-xs text-muted-foreground">
                Or enter this key manually: <span className="font-mono">{enrollment.secret}</span>
              </p>
              <div className="flex items-end gap-2">
                <Input
                  aria-label="Verification code"
                  inputMode="numeric"
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.currentTarget.value)}
                />
                <Button onClick={confirmEnrollment} disabled={pending || code.length !== 6}>
                  Confirm
                </Button>
              </div>
            </div>
          ) : status.data?.enrolled ? (
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Enabled</Badge>
              <span className="text-sm text-muted-foreground">
                {status.data.recoveryCodesRemaining} recovery codes remaining
              </span>
              <Button variant="outline" onClick={disableMfa} disabled={pending}>
                Disable
              </Button>
            </div>
          ) : (
            <Button className="self-start" onClick={beginEnrollment} disabled={pending}>
              Set up authenticator
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>Sign in with your device biometrics or security key.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <Input
              aria-label="Passkey name"
              placeholder="Work laptop"
              value={deviceName}
              onChange={(event) => setDeviceName(event.currentTarget.value)}
            />
            <Button onClick={() => void addPasskey()} disabled={pending}>
              Add passkey
            </Button>
          </div>
          {passkeys.loading ? (
            <Skeleton className="h-9 w-full" />
          ) : (passkeys.data ?? []).length === 0 ? (
            <EmptyState title="No passkeys are registered yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(passkeys.data ?? []).map((passkey: PasskeySummary) => (
                <li key={passkey.id} className="flex items-center justify-between py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{passkey.deviceName ?? 'Passkey'}</span>
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(passkey.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button variant="ghost" onClick={() => void removePasskey(passkey.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
