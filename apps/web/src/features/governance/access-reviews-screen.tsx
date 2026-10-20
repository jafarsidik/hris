'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { AccessReviewItemSummary, AccessReviewSummary } from '@hris/shared-types';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import {
  accessReviewsApi,
  type AccessReviewDetail,
} from '@/features/governance/access-reviews-api';
import {
  ACCESS_REVIEW_BUILT_IN_VIEWS,
  ACCESS_REVIEW_SEARCH_TEXT,
  ACCESS_REVIEW_VIEWS_STORAGE_KEY,
  buildAccessReviewColumns,
  buildAccessReviewFilters,
} from '@/features/governance/access-reviews-table-config';
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

const DECISIONS = ['NO_ACTION', 'APPROVED', 'REVOKED'] as const;

export function AccessReviewsScreen() {
  const router = useRouter();
  const { state } = useSession();
  const reviews = useIamLoad(() => accessReviewsApi.list(), []);
  const canManage = useCan('registry.manage');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [openReview, setOpenReview] = useState<AccessReviewDetail | null>(null);
  const [itemDecisions, setItemDecisions] = useState<
    Record<string, { decision: string; notes: string }>
  >({});

  const rows = (reviews.data ?? []) as AccessReviewSummary[];

  useEffect(() => {
    if (openReview === null) {
      setItemDecisions({});
    } else {
      const next: Record<string, { decision: string; notes: string }> = {};
      for (const item of openReview.items) {
        next[item.id] = { decision: item.decision, notes: item.notes ?? '' };
      }
      setItemDecisions(next);
    }
  }, [openReview]);

  const openDetail = async (review: AccessReviewSummary) => {
    setError(undefined);
    try {
      const detail = await accessReviewsApi.get(review.id);
      setOpenReview(detail);
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  const decide = async (item: AccessReviewItemSummary) => {
    const st = itemDecisions[item.id];
    if (!st || !openReview) {
      return;
    }
    setError(undefined);
    try {
      await accessReviewsApi.decide(openReview.id, item.id, st.decision, st.notes);
      setNotice(`Item decided: ${st.decision}.`);
      reviews.reload();
      setOpenReview(null);
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  return (
    <PageBody>
      <PageHeader
        title="Access Reviews"
        description="Periodic certification of user access grants."
      />

      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <HrisDataTable
        rows={rows}
        columns={buildAccessReviewColumns({ onOpen: (review) => void openDetail(review) })}
        filters={buildAccessReviewFilters(rows)}
        searchable
        searchText={ACCESS_REVIEW_SEARCH_TEXT}
        searchPlaceholder="Search by name, scope or reviewer…"
        selectable={false}
        views={{
          builtIn: ACCESS_REVIEW_BUILT_IN_VIEWS,
          storageKey: ACCESS_REVIEW_VIEWS_STORAGE_KEY,
        }}
        status={reviews.loading ? 'loading' : reviews.error !== undefined ? 'error' : 'ready'}
        errorCopy={reviews.error}
        onRetry={() => reviews.reload()}
        emptyTitle="No access reviews"
        emptyDescription="Access reviews created on the platform appear here."
        noResultsTitle="No reviews match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every review."
      />

      {openReview !== null && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Review: {openReview.name}</CardTitle>
                <CardDescription>
                  {openReview.decidedCount} / {openReview.itemCount} items decided
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenReview(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {openReview.items.length === 0 ? (
              <EmptyState title="No items in this review" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openReview.items.map((item) => {
                    const st = itemDecisions[item.id] ?? {
                      decision: item.decision,
                      notes: item.notes ?? '',
                    };
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">
                          {item.userDisplayName} ({item.userEmail})
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.resource}/{item.resourceId ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.permissions.join(', ')}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={st.decision}
                            onValueChange={(v) =>
                              setItemDecisions((prev) => {
                                const cur = prev[item.id] ?? {
                                  decision: item.decision,
                                  notes: item.notes ?? '',
                                };
                                return {
                                  ...prev,
                                  [item.id]: { ...cur, decision: v ?? cur.decision },
                                };
                              })
                            }
                            disabled={item.decision !== 'NO_ACTION'}
                          >
                            <SelectTrigger className="w-40" aria-label="Decision">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DECISIONS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={st.notes}
                            onChange={(e) =>
                              setItemDecisions((prev) => {
                                const cur = prev[item.id] ?? {
                                  decision: item.decision,
                                  notes: item.notes ?? '',
                                };
                                return {
                                  ...prev,
                                  [item.id]: { ...cur, notes: e.currentTarget.value },
                                };
                              })
                            }
                            placeholder="Notes"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {item.decision !== 'NO_ACTION' ? (
                            <span className="text-muted-foreground text-sm">
                              Decided: {item.decision}
                            </span>
                          ) : canManage ? (
                            <Button variant="outline" size="sm" onClick={() => void decide(item)}>
                              Decide
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
