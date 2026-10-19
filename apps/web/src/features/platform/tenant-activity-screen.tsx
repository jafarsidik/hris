'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { AuditLogReadModel } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { tenantActivityApi } from '@/features/platform/tenant-activity-api';
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

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function TenantActivityScreen() {
  const router = useRouter();
  const { state } = useSession();
  const [cursor, setCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const logs = useIamLoad(() => tenantActivityApi.list({ limit: 50, cursor }), [cursor]);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();

  const rows = (logs.data?.items ?? []) as AuditLogReadModel[];
  const hasMore = logs.data?.pageInfo.hasNextPage ?? false;
  const endCursor = logs.data?.pageInfo.endCursor ?? null;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !endCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await tenantActivityApi.list({ limit: 50, cursor: endCursor });
      setCursor(next.items[next.items.length - 1]?.createdAt ?? endCursor);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, endCursor]);

  return (
    <PageBody>
      <PageHeader
        title="Tenant Activity"
        description="Cross-tenant operational activity (audit log)."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {logs.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{logs.error}</AlertDescription>
        </Alert>
      )}

      {logs.loading && rows.length === 0 ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Audit events</CardTitle>
            <CardDescription>
              {rows.length} event{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="text-right">Chain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">
                      {formatTimestamp(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.actorUserId ?? 'system'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.action}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.resource}/{row.resourceId ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={row.chainVerified ? 'success' : 'secondary'}>
                        {row.chainVerified ? 'OK' : 'BROKEN'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
