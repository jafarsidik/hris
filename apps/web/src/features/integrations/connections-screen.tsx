'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plug, Stethoscope } from 'lucide-react';

import type { IntegrationConnectionTestResult, IntegrationSummary } from './integration-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCan, useSession } from '@/features/auth/session-context';
import { apiIntegrationRepository } from '@/features/integrations/integration-api';
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
  status: IntegrationSummary['status'],
): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (status === 'CONNECTED') return 'success';
  if (status === 'ERROR') return 'destructive';
  if (status === 'DISCONNECTED') return 'warning';
  return 'secondary';
}

/**
 * Connections: the outbound-connection overview (what is connected, to where, is it
 * healthy). Configuration lives behind each connection's detail page; this screen is the
 * list view an operator scans before opening one.
 */
export function ConnectionsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canManage = useCan('integration.manage');

  const [rows, setRows] = useState<readonly IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [testResult, setTestResult] = useState<{
    name: string;
    result: IntegrationConnectionTestResult;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await apiIntegrationRepository.listIntegrations());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const test = async (integration: IntegrationSummary) => {
    setError(undefined);
    setBusy(true);
    try {
      const result = await apiIntegrationRepository.testIntegration(integration.id);
      setTestResult({ name: integration.name, result });
      setRows((current) =>
        current.map((row) =>
          row.id === integration.id
            ? {
                ...row,
                status: result.status,
                lastCheckedAt: result.checkedAt,
                lastMessage: result.message,
              }
            : row,
        ),
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (integration: IntegrationSummary) => {
    setError(undefined);
    try {
      await apiIntegrationRepository.updateIntegration(integration.id, {
        isEnabled: !integration.isEnabled,
      });
      setRows((current) =>
        current.map((row) =>
          row.id === integration.id ? { ...row, isEnabled: !integration.isEnabled } : row,
        ),
      );
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="Connections"
        description="Reusable outbound connections — transport endpoints the platform delivers through."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {testResult !== null && (
        <Alert variant={testResult.result.ok ? 'success' : 'destructive'}>
          <AlertTitle>
            {testResult.name}: {testResult.result.ok ? 'connected' : 'failed'}
          </AlertTitle>
          <AlertDescription>
            {testResult.result.message} ({testResult.result.checkedAt})
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No connections configured" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
            <CardDescription>
              {rows.length} connection{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connection</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-sm">{row.provider}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      {row.lastMessage !== null && (
                        <div className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
                          {row.lastMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.lastCheckedAt ?? '—'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={row.isEnabled}
                        disabled={!canManage}
                        onCheckedChange={() => void toggle(row)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy || !canManage}
                          onClick={() => void test(row)}
                        >
                          <Stethoscope className="mr-1 size-4" aria-hidden />
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/setup/integrations/${row.id}`} />}
                        >
                          <Plug className="mr-1 size-4" aria-hidden />
                          Configure
                        </Button>
                      </div>
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
