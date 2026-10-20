'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { AiProviderSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { useCan, useSession } from '@/features/auth/session-context';
import { aiApi } from '@/features/ai/ai-api';
import { getIam } from '@/features/iam';
import { useIamLoad } from '@/features/iam/use-iam-data';

/**
 * Providers: the gateway's effective model-provider configuration. The API key lives in
 * the environment and is only reported as present/absent; the tenant-level on/off is the
 * `ai.enabled` system setting, so both switches an operator needs sit side by side.
 */
export function ProvidersScreen() {
  const router = useRouter();
  const { state } = useSession();
  const providers = useIamLoad(() => aiApi.providers(), []);
  const settings = useIamLoad(() => getIam().listSettings('general'), []);
  const canToggle = useCan('setting.update');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = (providers.data ?? []) as readonly AiProviderSummary[];
  const aiSetting = (settings.data ?? []).find((row) => row.key === 'ai.enabled');
  const companyEnabled = aiSetting?.value === 'true';

  return (
    <PageBody>
      <PageHeader
        title="Providers"
        description="Configured AI model providers and their effective state."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={providers.loading}
            onClick={() => providers.reload()}
          >
            Refresh
          </Button>
        }
      />

      <ErrorPanel error={providers.error} onRetry={() => providers.reload()} />

      {providers.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No provider configured" />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <Card key={row.key}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{row.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={row.envEnabled ? 'success' : 'secondary'}>
                      {row.envEnabled ? 'ENV ON' : 'ENV OFF'}
                    </Badge>
                    <Badge variant={row.apiKeyConfigured ? 'success' : 'warning'}>
                      {row.apiKeyConfigured ? 'API KEY SET' : 'NO API KEY'}
                    </Badge>
                    <Badge variant={row.companyEnabled ? 'success' : 'secondary'}>
                      {row.companyEnabled ? 'TENANT ON' : 'TENANT OFF'}
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  Source: {row.source} · base URL {row.baseUrl} · timeout {row.timeoutMs} ms
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground text-sm">Default model</dt>
                    <dd className="font-mono text-sm">{row.model}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Provider id</dt>
                    <dd className="font-mono text-sm">{row.provider}</dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <div className="font-medium text-sm">Enable AI for this tenant</div>
                    <p className="text-muted-foreground text-xs">
                      The `ai.enabled` system setting; environment and key must also be in place for
                      calls to succeed.
                    </p>
                  </div>
                  <Switch
                    checked={companyEnabled}
                    disabled={!canToggle || aiSetting === undefined || !aiSetting.isEditable}
                    onCheckedChange={(next) => {
                      void getIam()
                        .updateSettings([{ key: 'ai.enabled', value: next ? 'true' : 'false' }])
                        .then(() => settings.reload());
                    }}
                  />
                </div>

                {!row.envEnabled && (
                  <Alert>
                    <AlertTitle>Environment disabled</AlertTitle>
                    <AlertDescription>
                      Set `AI_ENABLED` in the API environment to allow model calls at all.
                    </AlertDescription>
                  </Alert>
                )}
                {row.envEnabled && !row.apiKeyConfigured && (
                  <Alert variant="destructive">
                    <AlertTitle>No API key</AlertTitle>
                    <AlertDescription>
                      Set `AI_API_KEY` in the API environment; without it every call short-circuits
                      to unavailable.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageBody>
  );
}
