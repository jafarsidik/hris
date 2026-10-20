'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';

import type { ApiRequestLogEntry } from './developer-types';
import { getDevelopers } from './index';
import { ServerPagedTable } from './server-paged-table';
import type { DataTableColumn } from '@/components/data-table';

function humanDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(
    new Date(value),
  );
}

const statusVariant = (status: number): 'success' | 'destructive' =>
  status < 400 ? 'success' : 'destructive';

/**
 * The requests made by developer API clients.
 *
 * One row per authenticated machine request, newest first, paginated with the shared
 * cursor contract so a growing log can never shift an already-served page. Only the
 * path is shown: the API never stores the query string.
 */
export function AccessLogScreen() {
  const router = useRouter();
  const { state } = useSession();
  const repository = getDevelopers();

  const [clientId, setClientId] = useState('ALL');
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<string[]>([]);

  const clients = useIamLoad(() => repository.listClients(), []);
  const log = useIamLoad(
    () =>
      repository.listRequests({
        ...(clientId === 'ALL' ? {} : { clientId }),
        ...(cursor === undefined ? {} : { cursor }),
      }),
    [clientId, cursor],
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  function nextPage() {
    const next = log.data?.pageInfo.endCursor;
    if (next !== null && next !== undefined) {
      setHistory((current) => [...current, cursor ?? '']);
      setCursor(next);
    }
  }

  function previousPage() {
    const previous = history.at(-1);
    if (previous !== undefined) {
      setHistory((current) => current.slice(0, -1));
      setCursor(previous === '' ? undefined : previous);
    }
  }

  /*
   * No `sortValue` on any column, and no search: the API serves this log newest-first
   * one cursor page at a time, so a client-side sort would reorder the rows in hand and
   * present that as the order of the log. The shared table's sorting stays off for the
   * same reason its search does — see ServerPagedTable.
   */
  const columns: readonly DataTableColumn<ApiRequestLogEntry>[] = [
    {
      id: 'when',
      header: 'When',
      cellClassName: 'text-muted-foreground',
      cell: (entry) => humanDate(entry.occurredAt),
    },
    {
      id: 'client',
      header: 'Client',
      cell: (entry) => entry.clientName,
    },
    {
      id: 'method',
      header: 'Method',
      cellClassName: 'font-mono text-xs',
      cell: (entry) => entry.method,
    },
    {
      id: 'path',
      header: 'Path',
      cellClassName: 'font-mono text-xs',
      cell: (entry) => entry.path,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (entry) => <Badge variant={statusVariant(entry.statusCode)}>{entry.statusCode}</Badge>,
    },
    {
      id: 'duration',
      header: 'Duration',
      align: 'right',
      cellClassName: 'tabular-nums',
      cell: (entry) => `${entry.durationMs} ms`,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="API Access Log"
        description="Requests made with a developer API key, newest first."
      />

      <ServerPagedTable
        rows={log.data?.items ?? []}
        columns={columns}
        actions={
          <Select
            value={clientId}
            onValueChange={(value) => {
              if (value !== null) {
                setClientId(value);
                setCursor(undefined);
                setHistory([]);
              }
            }}
          >
            <SelectTrigger aria-label="Filter by client" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All clients</SelectItem>
              {(clients.data ?? []).map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        loading={log.loading}
        error={log.error}
        onRetry={() => log.reload()}
        emptyTitle="No requests recorded for this filter."
        emptyDescription="Requests are recorded as the API is served; nothing has been written for this filter yet."
        pageInfo={log.data?.pageInfo ?? { hasNextPage: false, endCursor: null }}
        historyLength={history.length}
        onPrevious={previousPage}
        onNext={nextPage}
      />
    </PageBody>
  );
}
