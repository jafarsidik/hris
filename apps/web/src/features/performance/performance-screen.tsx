'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSession } from '@/features/auth/session-context';

import type { PerformanceCycle, PerformanceGoal, PerformanceReview } from './performance-types';

function cycleBadge(status: string) {
  switch (status) {
    case 'PLANNED':
      return <Badge variant="outline">Planned</Badge>;
    case 'ACTIVE':
      return <Badge variant="success">Active</Badge>;
    case 'REVIEW':
      return <Badge variant="warning">Review</Badge>;
    case 'CLOSED':
      return <Badge variant="outline">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Performance: cycles, employee goals with progress and submitted reviews.
 *
 * The goals list is the primary table and uses the shared data table. Cycles and
 * reviews are smaller embedded sub-tables in cards and keep their bespoke markup.
 */
export function PerformanceScreen({
  cycles,
  goals,
  reviews,
}: {
  cycles: readonly PerformanceCycle[];
  goals: readonly PerformanceGoal[];
  reviews: readonly PerformanceReview[];
}) {
  const router = useRouter();
  const { state } = useSession();

  const achieved = goals.filter((g) => g.status === 'ACHIEVED').length;
  const averageProgress =
    goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0;

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const goalColumns: readonly DataTableColumn<PerformanceGoal>[] = [
    {
      id: 'employee',
      header: 'Employee',
      sortValue: (row) => row.employeeName,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.employeeName}</div>
          <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
        </div>
      ),
    },
    {
      id: 'goal',
      header: 'Goal',
      sortValue: (row) => row.title,
      cellClassName: 'font-medium',
      cell: (row) => row.title,
    },
    {
      id: 'weight',
      header: 'Weight',
      sortValue: (row) => row.weight,
      align: 'center',
      cellClassName: 'font-mono text-sm',
      cell: (row) => `${row.weight}%`,
    },
    {
      id: 'progress',
      header: 'Progress',
      sortValue: (row) => row.progress,
      align: 'center',
      cell: (row) => (
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-sm">{row.progress}%</span>
          {row.status === 'ACHIEVED' && (
            <Badge variant="success" className="hidden sm:inline-flex">
              Achieved
            </Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader title="Performance" description="Cycles, employee goals and manager reviews." />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Goals</CardDescription>
            <CardTitle className="text-xl tabular-nums">{goals.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Achieved</CardDescription>
            <CardTitle className="text-xl tabular-nums">{achieved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Average progress</CardDescription>
            <CardTitle className="text-xl tabular-nums">{averageProgress}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {cycles.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Cycles</CardTitle>
            <CardDescription>{cycles.length} cycle(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell className="font-mono text-sm">{cycle.code}</TableCell>
                    <TableCell className="font-medium">{cycle.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                        new Date(cycle.startDate),
                      )}{' '}
                      –{' '}
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                        new Date(cycle.endDate),
                      )}
                    </TableCell>
                    <TableCell>{cycleBadge(cycle.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Goals</h2>
        <p className="text-sm text-muted-foreground">{goals.length} goal(s) across active cycles</p>
      </div>
      <HrisDataTable
        rows={goals}
        columns={goalColumns}
        searchable
        searchText={(row) => `${row.employeeName} ${row.employeeNumber} ${row.title}`}
        searchPlaceholder="Search goals…"
        selectable={false}
        emptyTitle="No goals yet"
        emptyDescription="Employee goals across active cycles appear here."
        noResultsTitle="No goals match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every goal."
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
          <CardDescription>{reviews.length} submitted review(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {reviews.length === 0 ? (
            <EmptyState title="No reviews submitted yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      <div className="font-medium">{review.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{review.employeeNumber}</div>
                    </TableCell>
                    <TableCell>{review.cycleName}</TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {review.reviewRating ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-[24rem] truncate text-sm">
                      {review.reviewSummary ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
