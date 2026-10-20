'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { IdentityProviderSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { platformApi, type CreateIdentityProviderInput } from '@/features/platform/platform-api';
import { ApiRequestError } from '@/lib/api/http-client';

const EMPTY_FORM = {
  name: '',
  type: 'OIDC' as 'OIDC' | 'SAML',
  domains: '',
  issuer: '',
  clientId: '',
  clientSecret: '',
  entryPoint: '',
  spIssuer: '',
  idpCert: '',
};

/**
 * Identity providers (System -> Security): configuration for enterprise SSO.
 *
 * The client secret is write-only: it is sent on create and never returned, so the
 * form starts blank on every visit.
 */
export function IdentityProvidersScreen() {
  const router = useRouter();
  const { state } = useSession();
  const list = useIamLoad(() => platformApi.listIdentityProviders(), []);

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const set = (key: keyof typeof EMPTY_FORM, value: string): void =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = useCallback(async () => {
    setError(undefined);
    setPending(true);
    try {
      const input: CreateIdentityProviderInput = {
        name: form.name,
        type: form.type,
        domains: form.domains
          .split(',')
          .map((domain) => domain.trim())
          .filter((domain) => domain.length > 0),
        ...(form.type === 'OIDC'
          ? {
              oidc: {
                issuer: form.issuer,
                clientId: form.clientId,
                clientSecret: form.clientSecret,
              },
            }
          : {
              saml: {
                entryPoint: form.entryPoint,
                issuer: form.spIssuer,
                idpCert: form.idpCert,
              },
            }),
      };
      await platformApi.createIdentityProvider(input);
      setForm(EMPTY_FORM);
      list.reload();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : 'The provider could not be saved.',
      );
    } finally {
      setPending(false);
    }
  }, [form, list]);

  return (
    <PageBody>
      <PageHeader
        title="Single sign-on"
        description="Connect enterprise identity providers so users can sign in with them."
      />

      {error !== undefined && <ErrorPanel error={error} />}

      <Card>
        <CardHeader>
          <CardTitle>Providers</CardTitle>
          <CardDescription>An OIDC or SAML connection per identity provider.</CardDescription>
        </CardHeader>
        <CardContent>
          {list.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (list.data ?? []).length === 0 ? (
            <EmptyState title="No identity providers are configured" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(list.data ?? []).map((provider: IdentityProviderSummary) => (
                <li key={provider.id} className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{provider.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {provider.domains.join(', ') || 'any domain'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{provider.type}</Badge>
                    <Badge variant={provider.enabled ? 'secondary' : 'outline'}>
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void platformApi.deleteIdentityProvider(provider.id).then(list.reload)
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add provider</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="idp-name">Name</Label>
            <Input
              id="idp-name"
              value={form.name}
              onChange={(event) => set('name', event.currentTarget.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="idp-type">Type</Label>
            <select
              id="idp-type"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.type}
              onChange={(event) => set('type', event.currentTarget.value)}
            >
              <option value="OIDC">OIDC</option>
              <option value="SAML">SAML</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="idp-domains">Email domains (comma separated)</Label>
            <Input
              id="idp-domains"
              placeholder="acme.test, acme.co.id"
              value={form.domains}
              onChange={(event) => set('domains', event.currentTarget.value)}
            />
          </div>

          {form.type === 'OIDC' ? (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="oidc-issuer">Issuer URL</Label>
                <Input
                  id="oidc-issuer"
                  value={form.issuer}
                  onChange={(event) => set('issuer', event.currentTarget.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="oidc-client">Client ID</Label>
                <Input
                  id="oidc-client"
                  value={form.clientId}
                  onChange={(event) => set('clientId', event.currentTarget.value)}
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor="oidc-secret">Client secret</Label>
                <Input
                  id="oidc-secret"
                  type="password"
                  value={form.clientSecret}
                  onChange={(event) => set('clientSecret', event.currentTarget.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="saml-entry">IdP SSO URL</Label>
                <Input
                  id="saml-entry"
                  value={form.entryPoint}
                  onChange={(event) => set('entryPoint', event.currentTarget.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="saml-issuer">SP entity ID</Label>
                <Input
                  id="saml-issuer"
                  value={form.spIssuer}
                  onChange={(event) => set('spIssuer', event.currentTarget.value)}
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor="saml-cert">IdP signing certificate</Label>
                <textarea
                  id="saml-cert"
                  className="min-h-24 rounded-md border border-input bg-transparent p-2 font-mono text-xs"
                  value={form.idpCert}
                  onChange={(event) => set('idpCert', event.currentTarget.value)}
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <Button onClick={() => void submit()} disabled={pending || form.name.length === 0}>
              Add provider
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageBody>
  );
}
