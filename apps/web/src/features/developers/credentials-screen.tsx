'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, RefreshCw } from 'lucide-react';

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
import { ApiRequestError } from '@/lib/api/http-client';

import type { DeveloperApiClient } from './developer-types';
import { getDevelopers } from './index';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The change could not be saved.';
}

function formatWhen(value: string | null): string {
  if (value === null) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function CopyButton({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Copy client id"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? (
        <Check className="size-4 text-primary" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
    </Button>
  );
}

/**
 * API Credentials: the credential material behind every API client — when keys were
 * issued, which clients sit unused, whether they are active, and a rotation flow
 * that reveals the new secret exactly once. Distinct from /setup/api/clients, which
 * CRUDs clients and their scopes.
 */
export function CredentialsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getDevelopers();
  const canUpdate = useCan('api-client.update');

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [rows, setRows] = useState<readonly DeveloperApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await repository.listClients());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = rows.filter((row) => row.isActive).length;
  const neverUsed = rows.filter((row) => row.lastUsedAt === null).length;

  const rotate = async (row: DeveloperApiClient) => {
    setBusyId(row.id);
    setError(undefined);
    try {
      await repository.rotateClient(row.id);
      setNotice(`New secret issued for "${row.name}".`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (row: DeveloperApiClient, active: boolean) => {
    try {
      await repository.updateClient(row.id, { isActive: active });
      setNotice(`Client "${row.name}" ${active ? 'activated' : 'deactivated'}.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="API Credentials"
        description="API key material across clients — issued age, last use, active state and rotation."
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
      {notice !== undefined && (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-4">
        <Stat label="Clients" value={String(rows.length)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Never used" value={String(neverUsed)} />
        <Stat label="Secret header" value="X-Api-Key" />
      </div>

      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No API clients have been created yet" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Client credentials</CardTitle>
            <CardDescription>
              {rows.length} client{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="font-mono text-sm">Client ID</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Last used</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Credential actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      {row.description !== null && (
                        <div className="text-xs text-muted-foreground">{row.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <div className="font-mono text-xs truncate w-48">{row.clientId}</div>
                      <CopyButton value={row.clientId} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatWhen(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatWhen(row.lastUsedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? 'success' : 'secondary'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canUpdate && row.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => void rotate(row)}
                          >
                            Rotate secret
                          </Button>
                        )}
                        {canUpdate && (
                          <Switch
                            checked={row.isActive}
                            disabled={busyId === row.id}
                            onCheckedChange={(next) => void toggleActive(row, next)}
                          />
                        )}
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
