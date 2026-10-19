'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import type { AiCallSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { aiApi } from '@/features/ai/ai-api';
import { useIamLoad } from '@/features/iam/use-iam-data';

const STATUS_OPTIONS = ['all', 'SUCCESS', 'FAILED'] as const;

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

/** AI Logs: the `ai_calls` audit feed — what was asked, of which model, at what cost in tokens. */
export function AiLogsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const calls = useIamLoad(
    () => aiApi.calls({ limit: 100, ...(status === 'all' ? {} : { status }) }),
    [status],
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const rows = (calls.data ?? []) as readonly AiCallSummary[];

  return (
    <PageBody>
      <PageHeader
        title="AI Logs"
        description="Model requests and their outcomes for audit."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus((value ?? 'all') as (typeof STATUS_OPTIONS)[number])
              }
            >
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'all' ? 'All statuses' : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={calls.loading}
              onClick={() => calls.reload()}
            >
              <RefreshCw className="mr-1 size-4" aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      {calls.error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{calls.error}</AlertDescription>
        </Alert>
      )}

      {calls.loading && rows.length === 0 ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No model requests recorded yet" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Requests</CardTitle>
            <CardDescription>{rows.length} most recent call(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{formatWhen(row.createdAt)}</TableCell>
                    <TableCell className="font-mono text-sm">{row.feature}</TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{row.model}</div>
                      <div className="text-xs text-muted-foreground">{row.provider}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'SUCCESS' ? 'success' : 'destructive'}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.inputTokens}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.outputTokens}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.latencyMs} ms
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
