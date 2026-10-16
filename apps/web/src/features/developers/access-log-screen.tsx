'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { ApiRequestLogEntry } from './developer-types';
import { getDevelopers } from './index';

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

  return (
    <PageBody>
      <PageHeader
        title="API Access Log"
        description="Requests made with a developer API key, newest first."
      />

      <PageToolbar>
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
      </PageToolbar>

      {log.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : log.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {log.error}
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(log.data?.items ?? []).map((entry: ApiRequestLogEntry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">
                    {humanDate(entry.occurredAt)}
                  </TableCell>
                  <TableCell>{entry.clientName}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.method}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.path}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(entry.statusCode)}>{entry.statusCode}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{entry.durationMs} ms</TableCell>
                </TableRow>
              ))}
              {(log.data?.items.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No requests recorded for this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={history.length === 0}
              onClick={() => previousPage()}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!(log.data?.pageInfo.hasNextPage ?? false)}
              onClick={() => nextPage()}
            >
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </>
      )}
    </PageBody>
  );
}
