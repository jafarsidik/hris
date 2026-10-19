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

import type { ShiftPattern } from './attendance-types';
import { timeLabel, workDaysLabel } from './shift-pattern-data';

/**
 * Shift Patterns: reusable shift definitions the roster is built from —
 * start/end times, break length and the days each pattern covers.
 */
export function ShiftPatternsScreen({ rows }: { rows: readonly ShiftPattern[] }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader
        title="Shift Patterns"
        description="Reusable shift definitions — hours, break and covered days."
      />
      <Card>
        <CardHeader>
          <CardTitle>Patterns</CardTitle>
          <CardDescription>{rows.length} shift pattern(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shift patterns defined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="text-center">Break</TableHead>
                  <TableHead>Work days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.description ?? ''}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {timeLabel(row.startTime)} – {timeLabel(row.endTime)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.breakMinutes} min
                    </TableCell>
                    <TableCell className="text-sm">{workDaysLabel(row.workDays)}</TableCell>
                    <TableCell>
                      {row.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
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
