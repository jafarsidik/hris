'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

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

/**
 * A log table on top of the shared one, with the client-side half switched off on purpose.
 *
 * Logs are the one list in the platform that cannot be searched, sorted or paged in the
 * browser. The API returns a cursor page of an unbounded, newest-first stream, so a
 * client-side sort would reorder the twenty-five rows in hand and present that as "sorted by
 * actor", and a client-side search would look for a string in those same twenty-five rows and
 * answer "nothing matches" about events it never asked for. Both would be worse than the
 * plain list, because both would be confidently wrong.
 *
 * So the shared table is used for what it does honestly here: the same chrome as every other
 * list, consistent loading and empty states, column visibility, and one place for the page's
 * own controls. Filtering stays a server query — passed through `actions`, which is the
 * toolbar's right-hand slot — and paging stays the API's cursor, rendered under the table.
 */
function LogsTable<TRow extends { readonly id: string }>({
  rows,
  columns,
  note,
  actions,
  loading,
  error,
  onRetry,
  emptyTitle,
  pageInfo,
  historyLength,
  onPrevious,
  onNext,
}: {
  readonly rows: readonly TRow[];
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly note: string;
  readonly actions?: ReactNode;
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly onRetry: () => void;
  readonly emptyTitle: string;
  readonly pageInfo: Paginated<never>['pageInfo'];
  readonly historyLength: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  return (
    <>
      <HrisDataTable
        rows={rows}
        columns={columns}
        searchable={false}
        selectable={false}
        pagination={false}
        actions={actions}
        status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
        errorCopy={error}
        onRetry={onRetry}
        emptyTitle={emptyTitle}
        emptyDescription="Events are recorded as the platform is used; nothing has been written for this filter yet."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{note}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={historyLength === 0} onClick={() => onPrevious()}>
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>
          <Button variant="outline" disabled={!pageInfo.hasNextPage} onClick={() => onNext()}>
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </>
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

  const columns: readonly DataTableColumn<LogEvent>[] = [
    {
      id: 'event',
      header: 'Event',
      cellClassName: 'font-mono text-xs',
      cell: (entry) => entry.eventType,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (entry) => <Badge variant="secondary">{entry.category}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (entry) => <Badge variant={STATUS_VARIANT(entry.status)}>{entry.status}</Badge>,
    },
    {
      id: 'actor',
      header: 'Actor',
      responsive: 'hidden md:table-cell',
      cellClassName: 'text-sm text-muted-foreground',
      cell: (entry) => entry.actorDisplayName ?? entry.actorUserId ?? '—',
    },
    {
      id: 'when',
      header: 'When',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      cell: (entry) => humanDate(entry.createdAt),
    },
  ];

  return (
    <PageBody>
      <PageHeader title={title} description={description} />

      <LogsTable
        rows={list.data?.items ?? []}
        columns={columns}
        note="Operational event log"
        actions={
          <div className="flex items-center gap-2">
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
          </div>
        }
        loading={list.loading}
        error={list.error}
        onRetry={() => list.reload()}
        emptyTitle="No log entries match this filter"
        pageInfo={list.data?.pageInfo ?? { hasNextPage: false, endCursor: null }}
        historyLength={history.length}
        onPrevious={previousPage}
        onNext={nextPage}
      />
    </PageBody>
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

  const columns: readonly DataTableColumn<AuditLogReadModel>[] = [
    {
      id: 'action',
      header: 'Action',
      cellClassName: 'font-mono text-xs',
      cell: (entry) => entry.action,
    },
    {
      id: 'resource',
      header: 'Resource',
      cell: (entry) => (
        <span className="text-sm">
          {entry.resource}
          {entry.resourceId !== null && (
            <span className="ml-1 font-mono text-xs text-muted-foreground">{entry.resourceId}</span>
          )}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      responsive: 'hidden md:table-cell',
      cellClassName: 'text-sm text-muted-foreground',
      cell: (entry) => entry.actorUserId ?? '—',
    },
    {
      id: 'chain',
      header: 'Chain',
      cell: (entry) =>
        entry.chainVerified ? (
          <Badge variant="default">
            <ShieldCheck aria-hidden="true" className="size-3" />
            Verified
          </Badge>
        ) : (
          <Badge variant="destructive">
            <ShieldAlert aria-hidden="true" className="size-3" />
            Integrity error
          </Badge>
        ),
    },
    {
      id: 'when',
      header: 'When',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      cell: (entry) => humanDate(entry.createdAt),
    },
  ];

  return (
    <PageBody>
      <PageHeader title={title} description={description} />

      <LogsTable
        rows={list.data?.items ?? []}
        columns={columns}
        note="Hash-chained audit trail"
        loading={list.loading}
        error={list.error}
        onRetry={() => list.reload()}
        emptyTitle="No audit entries match this filter"
        pageInfo={list.data?.pageInfo ?? { hasNextPage: false, endCursor: null }}
        historyLength={history.length}
        onPrevious={previousPage}
        onNext={nextPage}
      />
    </PageBody>
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
