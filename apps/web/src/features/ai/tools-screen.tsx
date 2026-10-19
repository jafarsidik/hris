'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';

import type { AiToolSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { useCan, useSession } from '@/features/auth/session-context';
import { aiApi } from '@/features/ai/ai-api';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

/**
 * Tools: the built-in functions the gateway can execute for an agent, with this
 * tenant's availability overrides. Disabling a tool here gates it off for every ask —
 * an agent whose grant list also names the tool gets it only when both allow it.
 */
export function ToolsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const tools = useIamLoad(() => aiApi.listTools(), []);
  const canManage = useCan('ai.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const rows = (tools.data ?? []) as readonly AiToolSummary[];

  const apply = useCallback(
    async (key: string, action: () => Promise<unknown>, message: string) => {
      setError(undefined);
      setNotice(undefined);
      setBusyKey(key);
      try {
        await action();
        setNotice(message);
        tools.reload();
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setBusyKey(null);
      }
    },
    [tools],
  );

  return (
    <PageBody>
      <PageHeader
        title="Tools"
        description="Callable functions an agent may use, and this tenant's availability overrides."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {tools.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{tools.error}</AlertDescription>
        </Alert>
      )}

      {tools.loading && rows.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No tools available" />
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Tool catalogue</CardTitle>
            <CardDescription>
              {rows.length} tool{rows.length === 1 ? '' : 's'} · overrides restore to the built-in
              default
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className={`flex flex-col gap-3 py-4 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      <code className="font-mono text-muted-foreground text-xs">{row.key}</code>
                      {row.overridden && <Badge variant="outline">OVERRIDDEN</Badge>}
                    </div>
                    <p className="mt-1 text-muted-foreground text-sm">{row.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{row.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    <Switch
                      checked={row.isEnabled}
                      disabled={!canManage || busyKey === row.key}
                      onCheckedChange={(next) =>
                        void apply(
                          row.key,
                          () => aiApi.setTool(row.key, next),
                          `${row.name} ${next ? 'enabled' : 'disabled'}.`,
                        )
                      }
                    />
                  </div>
                </div>
                {row.overridden && canManage && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyKey === row.key}
                      onClick={() =>
                        void apply(
                          row.key,
                          () => aiApi.resetTool(row.key),
                          `${row.name} restored to its default.`,
                        )
                      }
                    >
                      <RotateCcw className="mr-1 size-4" aria-hidden />
                      Restore default ({row.defaultEnabled ? 'on' : 'off'})
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
