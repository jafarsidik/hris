'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import type { AiCallSummary } from '@hris/shared-types';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

/**
 * AI Logs: the `ai_calls` audit feed — what was asked, of which model, at what cost in
 * tokens.
 *
 * The API returns a bounded array (up to 100 most recent calls), not a cursor page, so
 * the shared table searches, sorts and pages the rows it is given — exactly as the
 * users directory does with its own capped list. The status filter stays a server
 * query: it is passed through the toolbar's `actions` slot, and changing it re-runs
 * the request rather than filtering what is already on the client.
 */
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

  const rows = calls.data ?? [];

  const columns: readonly DataTableColumn<AiCallSummary>[] = [
    {
      id: 'when',
      header: 'When',
      sortValue: (row) => row.createdAt,
      cellClassName: 'font-mono text-sm',
      cell: (row) => formatWhen(row.createdAt),
    },
    {
      id: 'feature',
      header: 'Feature',
      sortValue: (row) => row.feature,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.feature,
    },
    {
      id: 'model',
      header: 'Model',
      sortValue: (row) => row.model,
      cell: (row) => (
        <div>
          <div className="font-mono text-sm">{row.model}</div>
          <div className="text-xs text-muted-foreground">{row.provider}</div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => row.status,
      cell: (row) => (
        <Badge variant={row.status === 'SUCCESS' ? 'success' : 'destructive'}>{row.status}</Badge>
      ),
    },
    {
      id: 'input',
      header: 'Input',
      align: 'right',
      sortValue: (row) => row.inputTokens,
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => row.inputTokens,
    },
    {
      id: 'output',
      header: 'Output',
      align: 'right',
      sortValue: (row) => row.outputTokens,
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => row.outputTokens,
    },
    {
      id: 'latency',
      header: 'Latency',
      align: 'right',
      sortValue: (row) => row.latencyMs,
      cellClassName: 'text-right font-mono text-sm',
      cell: (row) => `${row.latencyMs} ms`,
    },
  ];

  return (
    <PageBody>
      <PageHeader title="AI Logs" description="Model requests and their outcomes for audit." />

      <HrisDataTable
        rows={rows}
        columns={columns}
        searchable
        searchText={(row) => [row.feature, row.model, row.provider, row.status].join(' ')}
        searchPlaceholder="Search by feature, model or status…"
        selectable={false}
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
        status={calls.loading ? 'loading' : calls.error !== undefined ? 'error' : 'ready'}
        errorCopy={calls.error}
        onRetry={() => calls.reload()}
        emptyTitle="No model requests recorded yet"
        emptyDescription="Model requests are recorded as the platform is used; nothing has been written yet."
        noResultsTitle="No calls match this search"
        noResultsDescription="Try a different search, or clear the filters to see every call."
      />
    </PageBody>
  );
}
