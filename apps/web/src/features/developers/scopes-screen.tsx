'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCan, useSession } from '@/features/auth/session-context';
import { ApiRequestError } from '@/lib/api/http-client';
import { platformApi } from '@/features/platform/platform-api';

/**
 * API Scopes: the grantable `resource.action` scope vocabulary exposed by the
 * resource registry — what machine credentials can be scoped down to when an API
 * client is created or edited.
 */
export function ScopesScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canView = useCan('registry.view');

  const [error, setError] = useState<string | undefined>();
  const [rows, setRows] = useState<
    {
      scope: string;
      resource: string;
      action: string;
      description: string | null;
      custom: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const resources = await platformApi.listRegistryResources();
      const scopes: typeof rows = [];
      for (const resource of resources) {
        for (const action of resource.actions ?? []) {
          scopes.push({
            scope: `${resource.key}.${action.action}`,
            resource: resource.name,
            action: action.action,
            description: action.description,
            custom: action.isCustom,
          });
        }
      }
      scopes.sort((a, b) => a.scope.localeCompare(b.scope));
      setRows(scopes);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageBody>
      <PageHeader
        title="API Scopes"
        description="Grantable scopes for machine access — each scope is a registered resource action."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertTitle>Could not load scopes</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Scope catalogue</CardTitle>
          <CardDescription>
            {rows.length} grantable scope{rows.length === 1 ? '' : 's'} across registered resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No grantable scopes yet — register resource actions to create scopes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-sm">Scope</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="font-mono text-sm">Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Origin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.scope}>
                    <TableCell className="font-mono text-sm">{row.scope}</TableCell>
                    <TableCell>{row.resource}</TableCell>
                    <TableCell className="font-mono text-sm">{row.action}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.custom ? 'outline' : 'secondary'}>
                        {row.custom ? 'Custom' : 'Built-in'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!canView && (
        <Alert>
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            You don't have permission to read the registry; contact your administrator to manage
            scopes.
          </AlertDescription>
        </Alert>
      )}
    </PageBody>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}
