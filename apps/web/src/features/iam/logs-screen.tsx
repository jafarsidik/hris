'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditLogReadModel, LogEvent, Paginated } from '@hris/shared-types';

import { useSession } from '@/features/auth/session-context';
import { getIam } from '@/features/iam';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface LogsScreenProps {
  readonly mode?: 'events' | 'audit';
  /** Preset category filter for `events` (e.g. SECURITY on the login-history screen). */
  readonly presetCategory?: string;
  readonly title?: string;
  readonly description?: string;
}

const CATEGORIES = ['ACTIVITY', 'ACCESS', 'AUTHENTICATION', 'SECURITY', 'API', 'ERROR'] as const;
const STATUSES = ['SUCCESS', 'FAILURE', 'DENIED', 'PENDING'] as const;

const STATUS_VARIANT = (status: string | null): 'default' | 'secondary' | 'destructive' =>
  status === 'SUCCESS' ? 'default' : status === 'DENIED' ? 'destructive' : 'secondary';

function humanDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(
    new Date(value),
  );
}

function Pagination({
  pageInfo,
  historyLength,
  onPrevious,
  onNext,
}: {
  pageInfo: Paginated<never>['pageInfo'];
  historyLength: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" disabled={historyLength === 0} onClick={() => onPrevious()}>
        <ChevronLeft aria-hidden="true" className="size-4" />
        Previous
      </Button>
      <Button variant="outline" disabled={!pageInfo.hasNextPage} onClick={() => onNext()}>
        Next
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

interface LogViewProps {
  readonly presetCategory?: string;
  readonly title: string;
  readonly description: string;
}

function EventsView({ presetCategory, title, description }: LogViewProps) {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIam();
  const [category, setCategory] = useState(presetCategory ?? 'ALL');
  const [status, setStatus] = useState('ALL');
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<string[]>([]);

  const categories = presetCategory === undefined ? CATEGORIES : [presetCategory];

  const list = useIamLoad(
    () =>
      repository.listEvents(
        {
          category: category === 'ALL' ? undefined : category,
          status: status === 'ALL' ? undefined : status,
        },
        { cursor },
      ),
    [category, status, cursor],
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  function nextPage() {
    const next = list.data?.pageInfo.endCursor;
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
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={description} />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={category}
          onValueChange={(value) => {
            if (value !== null) {
              setCategory(value);
              setCursor(undefined);
              setHistory([]);
            }
          }}
        >
          <SelectTrigger aria-label="Filter by category" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {presetCategory === undefined && (
          <Select
            value={status}
            onValueChange={(value) => {
              if (value !== null) {
                setStatus(value);
                setCursor(undefined);
                setHistory([]);
              }
            }}
          >
            <SelectTrigger aria-label="Filter by status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="ml-auto text-sm text-muted-foreground">Operational event log</span>
      </div>

      {list.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error}
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.items.map((entry: LogEvent) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{entry.eventType}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{entry.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT(entry.status)}>{entry.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.actorDisplayName ?? entry.actorUserId ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {humanDate(entry.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
              {(list.data?.items.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No log entries match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            pageInfo={list.data?.pageInfo ?? { hasNextPage: false, endCursor: null }}
            historyLength={history.length}
            onPrevious={() => previousPage()}
            onNext={() => nextPage()}
          />
        </>
      )}
    </div>
  );
}

function AuditView({ title, description }: LogViewProps) {
  const router = useRouter();
  const { state } = useSession();
  const repository = getIam();
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<string[]>([]);

  const list = useIamLoad(() => repository.listAudit({}, { cursor }), [cursor]);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  function nextPage() {
    const next = list.data?.pageInfo.endCursor;
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
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={description} />

      <div className="flex items-center gap-2">
        <span className="ml-auto text-sm text-muted-foreground">Hash-chained audit trail</span>
      </div>

      {list.loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.error !== undefined ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error}
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.items.map((entry: AuditLogReadModel) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {entry.resource}
                      {entry.resourceId !== null && (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          {entry.resourceId}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.actorUserId ?? '—'}
                  </TableCell>
                  <TableCell>
                    {entry.chainVerified ? (
                      <Badge variant="default">
                        <ShieldCheck aria-hidden="true" className="size-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <ShieldAlert aria-hidden="true" className="size-3" />
                        Integrity error
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {humanDate(entry.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
              {(list.data?.items.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No audit entries match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            pageInfo={list.data?.pageInfo ?? { hasNextPage: false, endCursor: null }}
            historyLength={history.length}
            onPrevious={() => previousPage()}
            onNext={() => nextPage()}
          />
        </>
      )}
    </div>
  );
}

export function LogsScreen({
  mode = 'events',
  presetCategory,
  title = 'System Logs',
  description = 'Operational and security events recorded by the platform.',
}: LogsScreenProps) {
  if (mode === 'audit') {
    return <AuditView title={title} description={description} />;
  }
  return <EventsView presetCategory={presetCategory} title={title} description={description} />;
}
