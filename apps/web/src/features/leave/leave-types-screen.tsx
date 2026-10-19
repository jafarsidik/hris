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

import type { LeaveType } from './leave-types';

/**
 * Leave Types: the definitions that requests refer to — paid status and the
 * default number of days each type grants.
 */
export function LeaveTypesScreen({ rows }: { rows: readonly LeaveType[] }) {
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
        title="Leave Types"
        description="Leave type definitions — paid status and default entitlement."
      />
      <Card>
        <CardHeader>
          <CardTitle>Types</CardTitle>
          <CardDescription>{rows.length} leave type(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave types defined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="text-center">Default days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="max-w-[20rem] truncate text-sm">
                      {row.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      {row.isPaid ? (
                        <Badge variant="success">Paid</Badge>
                      ) : (
                        <Badge variant="outline">Unpaid</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.defaultDays}
                    </TableCell>
                    <TableCell>
                      {row.isActive ? (
                        <Badge variant="secondary">Active</Badge>
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
