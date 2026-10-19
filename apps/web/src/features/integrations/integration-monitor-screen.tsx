'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import type { IntegrationHealthSummary } from '@hris/shared-types';

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

function statusVariant(
  status: IntegrationHealthSummary['status'],
): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (status === 'CONNECTED') return 'success';
  if (status === 'ERROR') return 'destructive';
  if (status === 'DISCONNECTED') return 'warning';
  return 'secondary';
}

/**
 * External integration health at a glance: observed status, last check, and the last
 * 24 hours of delivery outcomes per connection. Configuration and testing live on the
 * Connections/detail screens; this one answers "is anything broken right now".
 */
export function IntegrationMonitorScreen() {
  const router = useRouter();
  const { state } = useSession();

  const [rows, setRows] = useState<readonly IntegrationHealthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [sampledAt, setSampledAt] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await integrationOpsApi.monitor());
      setSampledAt(new Date().toISOString());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unhealthy = rows.filter(
    (row) => row.status === 'ERROR' || row.status === 'DISCONNECTED' || row.failedLast24h > 0,
  ).length;

  return (
    <PageBody>
      <PageHeader
        title="Integration Monitor"
        description="External integration health and errors over the last 24 hours."
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
        <p className="text-sm text-muted-foreground">No integrations configured.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Health</CardTitle>
            <CardDescription>
              {rows.length} integration{rows.length === 1 ? '' : 's'}
              {unhealthy > 0 ? ` · ${unhealthy} need attention` : ' · all healthy'}
              {sampledAt !== null ? ` · sampled ${new Date(sampledAt).toLocaleTimeString()}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last check</TableHead>
                  <TableHead className="text-right">Delivered 24h</TableHead>
                  <TableHead className="text-right">Failed 24h</TableHead>
                  <TableHead className="text-right">Last delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.kind}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        {!row.isEnabled && <Badge variant="secondary">DISABLED</Badge>}
                      </div>
                      {row.lastMessage !== null && (
                        <div className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
                          {row.lastMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.lastCheckedAt ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.succeededLast24h}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${
                        row.failedLast24h > 0 ? 'text-destructive' : ''
                      }`}
                    >
                      {row.failedLast24h}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.lastDeliveryAt ?? '—'}
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
