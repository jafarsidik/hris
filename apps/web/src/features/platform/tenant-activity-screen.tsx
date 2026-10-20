'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { tenantActivityApi } from '@/features/platform/tenant-activity-api';
import { ApiRequestError } from '@/lib/api/http-client';

import type { AuditLogReadModel } from '@hris/shared-types';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * A read-only, cursor-paged audit log on top of the shared table.
 *
 * The audit log is an unbounded, newest-first stream served one cursor page at a time,
 * so the shared table is used for what it does honestly here: the same chrome as every
 * other list, consistent loading and empty states, and column visibility. Filtering,
 * search and paging stay server-side — the API owns the cursor — and the "Load more"
 * button below the table is the page's own control, rendered through `actions`.
 */
function ActivityTable({
  rows,
  columns,
  loading,
  error,
  onRetry,
  emptyTitle,
  hasMore,
  loadingMore,
  onLoadMore,
  loadError,
}: {
  readonly rows: readonly AuditLogReadModel[];
  readonly columns: readonly DataTableColumn<AuditLogReadModel>[];
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly onRetry: () => void;
  readonly emptyTitle: string;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly loadError: string | undefined;
}) {
  return (
    <>
      <HrisDataTable
        rows={rows}
        columns={columns}
        searchable={false}
        selectable={false}
        pagination={false}
        status={loading ? 'loading' : error !== undefined ? 'error' : 'ready'}
        errorCopy={error}
        onRetry={onRetry}
        emptyTitle={emptyTitle}
        emptyDescription="Events are recorded as the platform is used; nothing has been written yet."
      />
      {(hasMore || loadError !== undefined) && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {loadError !== undefined && <p className="text-sm text-destructive">{loadError}</p>}
          {hasMore && (
            <Button variant="outline" disabled={loadingMore} onClick={() => onLoadMore()}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export function TenantActivityScreen() {
  const router = useRouter();
  const { state } = useSession();
  const [cursor, setCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const logs = useIamLoad(() => tenantActivityApi.list({ limit: 50, cursor }), [cursor]);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [loadError, setLoadError] = useState<string | undefined>();

  const rows = (logs.data?.items ?? []) as AuditLogReadModel[];
  const hasMore = logs.data?.pageInfo.hasNextPage ?? false;
  const endCursor = logs.data?.pageInfo.endCursor ?? null;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !endCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await tenantActivityApi.list({ limit: 50, cursor: endCursor });
      setCursor(next.items[next.items.length - 1]?.createdAt ?? endCursor);
    } catch (cause) {
      setLoadError(messageOf(cause));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, endCursor]);

  const columns: readonly DataTableColumn<AuditLogReadModel>[] = [
    {
      id: 'when',
      header: 'When',
      sortValue: (row) => row.createdAt,
      cellClassName: 'font-mono text-sm',
      cell: (row) => formatTimestamp(row.createdAt),
    },
    {
      id: 'actor',
      header: 'Actor',
      sortValue: (row) => row.actorUserId ?? '',
      responsive: 'hidden md:table-cell',
      cellClassName: 'text-muted-foreground text-sm',
      cell: (row) => row.actorUserId ?? 'system',
    },
    {
      id: 'action',
      header: 'Action',
      sortValue: (row) => row.action,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.action,
    },
    {
      id: 'resource',
      header: 'Resource',
      sortValue: (row) => row.resource,
      responsive: 'hidden md:table-cell',
      cellClassName: 'text-muted-foreground text-sm',
      cell: (row) => `${row.resource}/${row.resourceId ?? '—'}`,
    },
    {
      id: 'chain',
      header: 'Chain',
      sortValue: (row) => (row.chainVerified ? 'OK' : 'BROKEN'),
      align: 'right',
      cell: (row) => (
        <Badge variant={row.chainVerified ? 'success' : 'secondary'}>
          {row.chainVerified ? 'OK' : 'BROKEN'}
        </Badge>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Tenant Activity"
        description="Cross-tenant operational activity (audit log)."
      />

      <ActivityTable
        rows={rows}
        columns={columns}
        loading={logs.loading && rows.length === 0}
        error={logs.error}
        onRetry={() => logs.reload()}
        emptyTitle="No activity recorded"
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => void loadMore()}
        loadError={loadError}
      />
    </PageBody>
  );
}
