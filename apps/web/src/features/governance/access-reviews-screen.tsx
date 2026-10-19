'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { AccessReviewItemSummary, AccessReviewSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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

      {reviews.loading && rows.length === 0 ? (
        <Skeleton className="h-60 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No access reviews.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
            <CardDescription>
              {rows.length} review{rows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((review) => {
                  return (
                    <TableRow key={review.id}>
                      <TableCell className="font-medium">{review.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {review.scope}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {review.reviewerId}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {review.decidedCount} / {review.itemCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={review.status === 'COMPLETED' ? 'success' : 'warning'}>
                          {review.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {review.dueAt ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => void openDetail(review)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
              <p className="text-sm text-muted-foreground">No items in this review.</p>
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
                            <SelectTrigger className="w-40">
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
