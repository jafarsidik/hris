'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
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

  return (
    <PageBody>
      <PageHeader title="Performance" description="Cycles, employee goals and manager reviews." />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Goals</CardDescription>
            <CardTitle className="text-2xl">{goals.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Achieved</CardDescription>
            <CardTitle className="text-2xl">{achieved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average progress</CardDescription>
            <CardTitle className="text-2xl">{averageProgress}%</CardTitle>
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

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <CardDescription>{goals.length} goal(s) across active cycles</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goals yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => (
                  <TableRow key={goal.id}>
                    <TableCell>
                      <div className="font-medium">{goal.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{goal.employeeNumber}</div>
                    </TableCell>
                    <TableCell className="font-medium">{goal.title}</TableCell>
                    <TableCell className="font-mono text-sm text-center">{goal.weight}%</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-sm">{goal.progress}%</span>
                        {goal.status === 'ACHIEVED' && (
                          <Badge variant="success" className="hidden sm:inline-flex">
                            Achieved
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
          <CardDescription>{reviews.length} submitted review(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews submitted yet.</p>
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
