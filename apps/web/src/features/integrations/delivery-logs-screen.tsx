'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import type { DeliveryLogEntry } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
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
import { integrationOpsApi } from '@/features/integrations/integration-ops-api';
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

function statusVariant(status: DeliveryLogEntry['status']): 'success' | 'destructive' | 'warning' {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'FAILED') return 'destructive';
  return 'warning';
}

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(
    new Date(value),
  );
}

/** One feed of every outbound delivery attempt, newest first, across all connections. */
export function DeliveryLogsScreen() {
  const router = useRouter();
  const { state } = useSession();

  const [rows, setRows] = useState<readonly DeliveryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await integrationOpsApi.deliveryLog(150));
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
        title="Delivery Logs"
        description="Per-message delivery outcomes across every connection, newest first."
        actions={
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className="mr-1 size-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No deliveries recorded yet" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Deliveries</CardTitle>
            <CardDescription>
              {rows.length} attempt{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempt</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{formatWhen(row.createdAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{row.integrationName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.integrationKind} · {row.integrationKey}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.operation}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.direction}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.attempt}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.durationMs === null ? '—' : `${row.durationMs} ms`}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground text-sm">
                      {row.error ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
