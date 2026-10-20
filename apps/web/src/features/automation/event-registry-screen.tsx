'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertTriangle, Search } from 'lucide-react';

import type { EventCategory } from '@hris/shared-types';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCan, useSession } from '@/features/auth/session-context';
import { buildEventColumns } from '@/features/automation/events-table-config';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { eventsApi } from '@/features/automation/events-api';
import { ApiRequestError } from '@/lib/api/http-client';

type BadgeTone =
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';

const CATEGORY_TONE: Readonly<Record<EventCategory, BadgeTone>> = {
  WORKFLOW: 'info',
  RECORDS: 'success',
  IDENTITY: 'warning',
  INTEGRATION: 'secondary',
  SYSTEM: 'destructive',
};
const DEFAULT_LIMIT = 50;

export function EventRegistryScreen() {
  const router = useRouter();
  const { state } = useSession();
  const [type, setType] = useState<string | undefined>();
  const [resource, setResource] = useState<string | undefined>();
  const [pendingOnly, setPendingOnly] = useState(false);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const snapshot = useIamLoad(
    () => eventsApi.list({ type, resource, pendingOnly, limit }),
    [type, resource, pendingOnly, limit],
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const canRetry = useCan('workflow.manage');

  const onRetry = useCallback(
    async (id: string) => {
      setError(undefined);
      setNotice(undefined);
      try {
        await eventsApi.retry(id);
        setNotice('Delivery retried.');
        snapshot.reload();
      } catch (cause) {
        if (cause instanceof ApiRequestError) {
          setError(cause.details?.[0]?.message ?? cause.message);
        } else if (cause instanceof Error) {
          setError(cause.message);
        } else {
          setError('The request could not be completed.');
        }
      }
    },
    [snapshot],
  );

  const events = snapshot.data?.recent ?? [];
  const pending = snapshot.data?.pending ?? 0;
  const catalogue = snapshot.data?.types ?? [];

  return (
    <PageBody>
      <PageHeader
        title="Event Registry"
        description="The catalogue of domain events the platform emits, and the recent history of what happened in this tenant."
      />

      {error !== undefined && <ErrorPanel error={error} />}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/*
          The catalogue stays a bespoke list rather than a shared table: it is a filter
          panel, not a data table. Its search filters the list locally and clicking an
          entry sets the server-side `type` filter for the history — wrapping it in the
          shared table would add a column-visibility toggle and saved views that mean
          nothing for a button list, and the 280px sidebar is too narrow for real table
          columns without losing the description.
        */}
        <Card>
          <CardHeader>
            <CardTitle>Event Catalogue</CardTitle>
            <CardDescription>
              {catalogue.length} types the platform emits. Click one to filter recent history.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Filter types…"
                value={type ?? ''}
                onChange={(e) => setType(e.target.value || undefined)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-1 max-h-[500px] overflow-y-auto">
              {catalogue
                .filter(
                  (t) => type === undefined || t.type.toLowerCase().includes(type.toLowerCase()),
                )
                .map((eventType) => (
                  <button
                    key={eventType.type}
                    aria-pressed={type === eventType.type}
                    className="text-left p-2 rounded-md hover:bg-accent transition-colors"
                    onClick={() => setType(eventType.type)}
                  >
                    <div className="font-mono text-sm font-medium">{eventType.type}</div>
                    <div className="text-xs text-muted-foreground">{eventType.description}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant={CATEGORY_TONE[eventType.category]} className="text-xs">
                        {eventType.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{eventType.resource}</span>
                    </div>
                  </button>
                ))}
              {catalogue.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No matching event types.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>
                  {events.length} event{events.length === 1 ? '' : 's'}
                  {pending > 0 && (
                    <span className="ml-2">
                      <AlertTriangle className="inline size-3 mr-1" />
                      {pending} awaiting delivery
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger className="w-24" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100, 200].map((opt) => (
                      <SelectItem key={opt} value={opt.toString()}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => snapshot.reload()}
                  disabled={snapshot.loading}
                >
                  <RefreshCw className={`mr-1 size-4 ${snapshot.loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
            <PageToolbar>
              <div className="flex items-center gap-2">
                <Select
                  value={resource ?? 'all'}
                  onValueChange={(v) => setResource(v === null || v === 'all' ? undefined : v)}
                >
                  <SelectTrigger className="w-40" aria-label="Filter by resource">
                    <SelectValue placeholder="All resources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All resources</SelectItem>
                    {[
                      'record',
                      'task',
                      'workflow-instance',
                      'workflow-task',
                      'user',
                      'integration',
                    ].map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingOnly(!pendingOnly)}
                  className={pendingOnly ? 'bg-primary text-primary-foreground' : ''}
                >
                  <AlertTriangle className="mr-1 size-4" />
                  Pending only
                </Button>
              </div>
            </PageToolbar>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/*
              The history is a server slice, so the shared table runs without client-side
              search, sort or paging — those would present a partial list as if it were
              the whole. The server controls above stay the source of truth for what the
              slice contains.
            */}
            <HrisDataTable
              rows={events}
              columns={buildEventColumns({ canRetry, onRetry })}
              searchable={false}
              pagination={false}
              selectable={false}
              status={
                snapshot.loading ? 'loading' : snapshot.error !== undefined ? 'error' : 'ready'
              }
              errorCopy={snapshot.error}
              onRetry={() => snapshot.reload()}
              emptyTitle="No events match this view"
              emptyDescription="Try a different resource, or clear the filters to see every recent event."
              noResultsTitle="No events match this view"
              noResultsDescription="Try a different resource, or clear the filters to see every recent event."
            />
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
